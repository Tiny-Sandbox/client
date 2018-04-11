const indOn = new Image();
indOn.src = "https://vignette.wikia.nocookie.net/minecraft/images/d/db/Redstone_lamp_.jpg/revision/latest?cb=20150826232718";

(async function() {
	try {
		/* --------------------------------------------------------------------------
		    Helpful functions
		----------------------------------------------------------------------------- */

		// derived from https://stackoverflow.com/a/901144
		function param(name, url = window.location.href) {
			name = name.replace(/[\[\]]/g, "\\$&");
			const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
			const results = regex.exec(url);
			if (!results) return null;
			if (!results[2]) return "";
			return decodeURIComponent(results[2].replace(/\+/g, " "));
		}

		function findKeyMeaning(code) {
			for (let index = 0; index < inputs.length; index++) {
				if (inputs[index].includes(code)) {
					return {
						meaning: index,
						owner: inputs[index].indexOf(code),
					};
				}
			}
		}

		function generateRandomTile(rand, x, y) {
			switch (Math.round(Math.random() * rand)) {
				case 5:
					return new FlashingIndicator(x, y, Math.round(Math.random() / 2) * 10);
			default: return new PowerTurf(1, x, y);
			}
		}

		function getSpawnables(pid) {
			const directlySpawnable = arenaMap.getMatchingTiles(function(tile) {
				return tile.constructor.name === "SpawnableSpace" && (tile.restriction === pid || tile.restriction === null);
			});
			const spawnableSpaces = arenaMap.getMatchingTiles(function(tile) {
				return tile.constructor.name === "Space";
			});
			const collidableSpaces = arenaMap.getMatchingTiles(function(tile) {
				return !tile.collides(0);
			});

			if (directlySpawnable.length > 0) {
				return directlySpawnable;
			} else if (spawnableSpaces.length > 0) {
				// If no spawnable tiles to be found, just spawn on a space.
				return spawnableSpaces;
			} else {
				// If no spaces, just pick one that doesn't collide up.
				return collidableSpaces;
			}
		}

		function randItem(array) {
			return array[Math.floor(Math.random() * array.length)];
		}

		function generateBase(player) {
			arenaMap.getTile(player.position.x, player.position.y).changeTo(new HomeSpace(player));
			arenaMap.getTile(player.position.x, player.position.y).changeTo(new Occupied(player));
		}

		function getMousePos(evt) {
			const rect = canvas.getBoundingClientRect();
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;

			return {
				x: Math.floor((evt.clientX - rect.left) * scaleX / tileDensity),
				y: Math.floor((evt.clientY - rect.top) * scaleY / tileDensity),
			};
		}

		function makeArray(w, h) {
			return new Promise(resolve => {
				const arr = [];
				for (let i = 0; i < h; i++) {
					arr[i] = [];
					for (let j = 0; j < w; j++) {
						arr[i][j] = generateRandomTile(20, j, i);
					}
				}
				resolve(arr);
			});
		}

		function tryTileAction(tile, direction, player) {
			if (tile.doFacingAction && typeof tile.doFacingAction === "function") {
				tile.doFacingAction(direction, player);
			}
		}

		class TileMap {
			constructor(twodeearray) {
				this.map = twodeearray;
			}

			getTile(x, y) {
				return this.map[y][x];
			}

			getMatchingTiles(callback) {
				const matching = [];

				for (const item of this.map) {
					for (const item2 of item) {
						if (callback(item2)) {
							matching.push(item2);
						}
					}
				}

				return matching;
			}

			getSize() {
				const height = this.map.length;
				const length = this.map[0].length;

				return {
					height: height,
					length: length,
					area: height * length,
				};
			}
		}

		/* --------------------------------------------------------------------------
		    Tile classes
		----------------------------------------------------------------------------- */

		class Player {
			constructor(id, x, y) {
				this.id = id;

				this.position = {
					x: x,
					y: y,
				};

				this.direction = 0;

				this.color = `hsl(${this.id / playerCount * 360}, 50%, 50%)`;

				this.keys = 0;
			}
		}

		class Space {
			constructor(x, y) {
				this.position = {
					x: x,
					y: y,
				};

				this.color = "white";

				this.oldTile = null;
				this.occupying = null;
			}
			
			isPowered() {
				return false;
			}

			getRendering() {
				return {
					type: "color",
					color: this.color,
				};
			}

			changeTo(newSpace) {
				newSpace.position.x = this.position.x;
				newSpace.position.y = this.position.y;
				newSpace.oldTile = this;
				newSpace.occupying = this.constructor.name;
				arenaMap.map[this.position.y][this.position.x] = newSpace;
			}

			collides() {
				return false;
			}

			afterTurn() {
				return;
			}

			changeBack() {
				if (this.oldTile) {
					this.changeTo(this.oldTile);
					return true;
				} else {
					return false;
				}
			}

			toString() {
				return this.constructor.name;
			}
		}

		function neighbor(tile, dirTo) {
			const x = tile.position.x;
			const y = tile.position.y;

			try {
				switch (dirTo) {
				case 3:
					return arenaMap.getTile(x + 1, y);
				case 2:
					return arenaMap.getTile(x, y + 1);
				case 1:
					return arenaMap.getTile(x - 1, y);
				default:
					return arenaMap.getTile(x, y - 1);
				}
			} catch (error) {
				return false;
			}
		}

		function neighborPowered(tile) {
			const neighbors = [];
			for (let loop = 0; loop < 4; loop++) {
				const neighborWeAreOn = neighbor(tile, loop);
				if (neighborWeAreOn) {
					neighbors.push(neighborWeAreOn);
				}
			}

			return neighbors.some(oneTile => {
				return oneTile.isPowered();
			});
		}

		class SpawnableSpace extends Space {
			constructor(restrictedTo, x, y) {
				super(x, y);
				this.restriction = restrictedTo ? restrictedTo : null;
			}

			toString() {
				return "Spawn space";
			}
		}

		class Wall extends Space {
			constructor(x, y) {
				super(x, y);
				this.color = "black";
			}

			collides() {
				return true;
			}
		}
		
		class ColoredWall extends Wall {
			constructor(color, x, y) {
				super(x, y);
				this.color = color;
			}
			changeColor(newColor) {
				this.color = newColor;
			}
			toString() {
				return `Wall colored ${this.color}`;
			}
		}

		class PowerSource extends Wall {
			constructor(x, y) {
				super(x, y);
			}

			getColor() {
				return "red";
			}

			isPowered() {
				return true;
			}
		}
		
		function indicatorRendering(expression) {
			return expression ? {
      	type: "image",
        image: indOn,
      } : {
      	type: "color",
        color: "#4b3621",
      };
		}

		class PowerIndicator extends Wall {
			constructor(x, y) {
				super(x, y);
			}

			getRendering() {
				return indicatorRendering(neighborPowered(this));
			}
		}
		
		class FlashingIndicator extends Wall {
			constructor(x, y, flashTiming = 1000) {
				super(x, y);
				this.flashTiming = flashTiming;
			}
			
			getRendering() {
				return indicatorRendering(Math.round(performance.now() / this.flashTiming) % 2);
			}
		}

		class PowerCarrier extends Space {}

		class PowerCarrierWall extends Wall {}

		class Teleporter extends Space {
			constructor(id, x, y) {
				super(x, y);

				this.id = id;
				this.color = "purple";
			}

			collides() {
				return false;
			}

			afterTurn(player) {
				const compatTeleports = arenaMap.getMatchingTiles(tile => {
					return tile.constructor.name === "Teleporter" && tile.id === this.id;
				});
				const exit = randItem(compatTeleports);

				const pos = player.position;
				const plTile = arenaMap.getTile(pos.x, pos.y);
				const exitTile = arenaMap.getTile(exit.position.x, exit.position.y);

				plTile.changeBack();
				exitTile.changeTo(plTile);

				players[player.id].position.x = exit.position.x;
				players[player.id].position.y = exit.position.y;
			}
		}

		class Occupied extends Wall {
			constructor(player, x, y) {
				super(x, y);
				this.occupiedBy = player;
			}

			getRendering() {
				return {
					type: "color",
					color: this.occupiedBy.color,
				};
			}

			toString() {
				return `Player ${this.occupiedBy.id + 1}'s tile`;
			}
		}

		class Turf extends Space {
			constructor(recaptures, x, y) {
				super(x, y);
				this.capturedBy = null;
				this.recaptures = recaptures;
				this.captureCount = 0;
			}
			getRendering() {
				return {
        	type: "color",
          color: this.capturedBy ? this.capturedBy.color : "#FFFFFF",
        }
			}
			collides(d, p) {
				if ((this.recaptures >= this.captureCount || !this.capturedBy)) {
					this.capturedBy = p;
					this.captureCount++;
				}

				return false;
			}

			toString() {
				if (this.capturedBy) {
					return `Player ${this.capturedBy.id + 1}'s turf`;
				} else {
					return this.constructor.name;
				}
			}
		}

		class PowerTurf extends Turf {
			constructor(recaptures, x, y) {
				super(recaptures, x, y);
			}

			isPowered() {
				return this.capturedBy && neighborPowered(this);
			}
      
      toString() {
				if (this.capturedBy) {
					return `Player ${this.capturedBy.id + 1}'s power-connecting turf`;
				} else {
					return "Power-connecting turf";
				}
			}
		}

		class HomeSpace extends Wall {
			constructor(owner, x, y) {
				super(x, y);
				this.owner = owner;
			}

			collides(direction, player) {
				return player.id !== this.owner.id;
			}

			getRendering() {
				return {
        	type: "color",
          color: this.owner.color,
        };
			}

			toString() {
				return `Player ${this.owner.id + 1}'s home tile`;
			}
		}

		class LockedWall extends Wall {
			constructor(x, y, keysNeeded = 1, takeAwayKeys = false) {
				super(x, y);
				this.color = "slategray";

				this.keysNeeded = keysNeeded;
				this.takeAwayKeys = takeAwayKeys;
			}

			collides(direction, player) {
				if (player.keys < this.keysNeeded) {
					return true;
				} else {
					if (this.takeAwayKeys) {
						players[player.id].keys -= this.keysNeeded;
					}
					return false;
				}
			}

			toString() {
				return `${this.takeAwayKeys ? "Unstable l" : "L"}ocked wall requiring ${this.keysNeeded} key${this.keysNeeded === 1 ? "" : "s"}`;
			}
		}

		const directions = [
			"north",
			"east",
			"south",
			"west",
		];

		class DirectionalWall extends Wall {
			// this type of wall only collides in one direction
			constructor(direction, x, y) {
				super(x, y);

				this.color = "#FFEE00";
				this.direction = direction > -1 && direction < 4 ? direction : 0;
			}

			collides(direction = 2) {
				return direction === this.direction;
			}

			toString() {
				return `One-way gate facing ${directions[this.direction]}`;
			}
		}

		class ToggleableWall extends Wall {
			// this type of wall can be toggled for collision, but starts out closed
			constructor(x, y) {
				super(x, y);

				this.color = "pink";
				this.closed = true;
			}

			collides() {
				return this.closed;
			}

			doFacingAction() {
				this.closed = !this.closed;
			}

			toString() {
				return `${this.closed ? "Closed t" : "T"}oggleable wall`;
			}
		}

		class ItemBox extends Space {
			constructor(x, y) {
				super(x, y);

				this.color = "#dd66ff";
				this.active = true;
			}

			collides(direction, player) {
				if (this.active) {
					players[player.id].keys += 1;
					this.active = false;
				}
				return false;
			}

			toString() {
				return this.active ? "Item box" : "Empty item box";
			}
		}

		class CooperativeSwitch extends Space {
			constructor(x, y) {
				super(x, y);

				this.color = "#7777FF";
			}
		}

		class CooperativePuzzleWall extends Wall {
			constructor(strengthNeeded, x, y) {
				super(x, y);

				this.color = "#9999FF";
				this.strengthNeeded = strengthNeeded;
			}

			collides() {
				return arenaMap.getMatchingTiles((item) => {
					if (item.constructor.name !== "Occupied") return false;
					return item.oldTile.constructor.name === "CooperativeSwitch";
				}).length < this.strengthNeeded;
			}

			toString() {
				return "Cooperative wall";
			}
		}

		/* --------------------------------------------------------------------------
		        The logic
		----------------------------------------------------------------------------- */

		const canvas = document.getElementById("c");
		const ctx = canvas.getContext("2d");

		ctx.fillText("Hello there! Something might've gone wrong.", canvas.width / 2, canvas.height / 2);

		const hud = document.getElementById("hud");
		const hctx = hud.getContext("2d");

		let mapHoverLocation = {};
    
    let currentTurn = 0;
		const playerCount = param("players") || 2;
		const sandbox = param("sandbox") != true;
		const cooperativeMode = param("coop") != true;

		const arenaWidth = Math.ceil(Math.random() * 15 + playerCount);
		const arenaHeight = arenaWidth;

		const tileDensity = 16;
		canvas.width = arenaWidth * tileDensity;
		canvas.height = arenaHeight * tileDensity;

		hud.width = window.innerWidth * 0.80;
		hud.height = window.innerHeight * 0.15;

		canvas.style.width = window.innerWidth * 0.80 + "px";
		canvas.style.height = window.innerHeight * 0.80 + "px";

		const inputs = [
			["KeyW", "KeyI", "ArrowUp"],
			["KeyA", "KeyJ", "ArrowLeft"],
			["KeyS", "KeyK", "ArrowDown"],
			["KeyD", "KeyL", "ArrowRight"],
			["Spacebar"],
		];

		const arenaMapNotClassYet = await makeArray(arenaWidth, arenaHeight);
		const arenaMap = new TileMap(arenaMapNotClassYet);

		arenaMap.getTile(0, 0).changeTo(new SpawnableSpace(null));
		arenaMap.getTile(0, arenaHeight - 1).changeTo(new SpawnableSpace(null));
		arenaMap.getTile(arenaWidth - 1, 0).changeTo(new SpawnableSpace(null));
		arenaMap.getTile(arenaWidth - 1, arenaHeight - 1).changeTo(new SpawnableSpace(null));

		const players = [];
		for (let p = 0; p < playerCount; p++) {
			const randSpace = randItem(getSpawnables(p));
			const playerX = randSpace.position.x;
			const playerY = randSpace.position.y;

			players.push(new Player(p, playerX, playerY));
			generateBase(players[p]);
		}

		arenaMap.getMatchingTiles(tile => {
			return tile.constructor.name === "SpawnableSpace";
		}).forEach(tile => {
			tile.changeTo(generateRandomTile(tile.position.x, tile.position.y));
		});

		canvas.addEventListener("mousemove", (event) => {
			const pos = getMousePos(event);
			mapHoverLocation = {
				coordinates: pos,
				tile: arenaMap.getTile(pos.x, pos.y),
			};
		});
		canvas.addEventListener("mousedown", event => {
			mapHoverLocation.tile.changeTo(generateRandomTile(mapHoverLocation.tile.position.x, mapHoverLocation.tile.position.y));
		});

		window.addEventListener("keydown", (event) => {
			const keyInfo = findKeyMeaning(event.code);
			const currentPlayer = cooperativeMode ? players[keyInfo.owner] : players[currentTurn];
			const currentID = currentPlayer.id;

			const curTile = arenaMap.getTile(currentPlayer.position.x, currentPlayer.position.y);

			let turnHasFinished = true;

			switch (keyInfo.meaning) {
			case 0:
			{
				const tileUp = arenaMap.getTile(currentPlayer.position.x, currentPlayer.position.y - 1);

				players[currentID].direction = 0;
				if (!tileUp.collides(2, currentPlayer) || (sandbox && event.shiftKey)) {
					curTile.changeBack();
					tileUp.changeTo(curTile);
					players[currentID].position.y--;
				} else {
					turnHasFinished = false;
				}
				break;
			}
			case 1:
			{
				const tileLeft = arenaMap.getTile(currentPlayer.position.x - 1, currentPlayer.position.y);
				players[currentID].direction = 1;
				if (!tileLeft.collides(3, currentPlayer) || (sandbox && event.shiftKey)) {
					curTile.changeBack();
					tileLeft.changeTo(curTile);
					players[currentID].position.x--;
				} else {
					turnHasFinished = false;
				}
				break;
			}
			case 2:
			{
				const tileDown = arenaMap.getTile(currentPlayer.position.x, currentPlayer.position.y + 1);
				players[currentID].direction = 2;
				if (!tileDown.collides(0, currentPlayer) || (sandbox && event.shiftKey)) {
					curTile.changeBack();
					tileDown.changeTo(curTile);
					players[currentID].position.y++;
				} else {
					turnHasFinished = false;
				}
				break;
			}
			case 3:
			{
				const tileRight = arenaMap.getTile(currentPlayer.position.x + 1, currentPlayer.position.y);
				players[currentID].direction = 3;
				if (!tileRight.collides(1, currentPlayer) || (sandbox && event.shiftKey)) {
					curTile.changeBack();
					tileRight.changeTo(curTile);
					players[currentID].position.x++;
				} else {
					turnHasFinished = false;
				}
				break;
			}
			case 4:
			{
				switch (currentPlayer.direction) {
				case 1:
					tryTileAction(arenaMap.getTile(currentPlayer.position.x - 1, currentPlayer.position.y), 1, currentPlayer);
					break;
				case 2:
					tryTileAction(arenaMap.getTile(currentPlayer.position.x, currentPlayer.position.y + 1), 2, currentPlayer);
					break;
				case 3:
					tryTileAction(arenaMap.getTile(currentPlayer.position.x + 1, currentPlayer.position.y), 3, currentPlayer);
					break;
				default:
					tryTileAction(arenaMap.getTile(currentPlayer.position.x, currentPlayer.position.y - 1), 0, currentPlayer);
					break;
				}
				break;
			}
			default:
				turnHasFinished = false;
			}

			const newpl = players[currentID];
			const newt = arenaMap.getTile(newpl.position.x, newpl.position.y).oldTile;
			newt.afterTurn(newpl);

			if (turnHasFinished && !(sandbox && event.altKey)) {
				currentTurn++;
				if (currentTurn === players.length) {
					currentTurn = 0;
				}
			}
		});
    
    function renderSquare(x, y, color) {
    	ctx.fillStyle = color;
      ctx.fillRect(x * tileDensity, y * tileDensity, tileDensity, tileDensity);
    }

		function renderTile(tile) {
    	const oldStyle = ctx.fillStyle;
    	const x = tile.position.x;
      const y = tile.position.y;
      
      if (tile.getRendering) {
        const rendering = tile.getRendering();
        switch (rendering.type) {
        	case "color": {
        		renderSquare(x, y, rendering.color);
            break;
          }
          case "image": {
          	ctx.drawImage(rendering.image, x * tileDensity, y * tileDensity, tileDensity, tileDensity);
          }
        }
      } else {
      	// Allow defunct getColor until transition is complete
        renderSquare(x, y, tile.getColor());
      }
      
      ctx.fillStyle = oldStyle;
			return;
		}

		function render() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			for (let y = 0; y < arenaHeight; y++) {
				for (let x = 0; x < arenaWidth; x++) {
					const curTile = arenaMap.getTile(x, y);
					const underTile = curTile.oldTile;
					if (underTile) {
						renderTile(underTile);
					}
					renderTile(curTile);
				}
			}

			// Clear the HUD.
			hctx.fillStyle = "#222222";
			hctx.fillRect(0, 0, hud.width, hud.height);

			// Get some HUD backgrounds.
			hctx.fillStyle = cooperativeMode ? "#77ffff" : players[currentTurn].color;
			hctx.fillRect(0, 0, hud.width / 4, hud.height);

			// Cool font and color.
			hctx.font = `${hud.width / 20}px Ubuntu`;
			hctx.fillStyle = "white";

			// Center text.
			hctx.textAlign = "center";
			hctx.textBaseline = "middle";

			// Render some HUD stats.
			const playerText = cooperativeMode ? "CO-OP" : `PLAYER ${currentTurn + 1}`;
			hctx.fillText(playerText, hud.width / 8, hud.height / 2);

			hctx.font = "12px Ubuntu";
			hctx.textBaseline = "top";

			if (sandbox) {
				hctx.textAlign = "right";
				hctx.fillText("*", hud.width / 4 - 1, 0);
			}

			hctx.textAlign = "left";
			const text = [
				"Use WASD, arrows, and/or IJKL to navigate.",
				cooperativeMode ? "Work together to do things." : "Each player takes turns moving.",
				"You can only move to tiles that are white (empty spaces).",
				"There is no objective yet.",
				"Have fun!",
			];

			text.forEach((value, index) => {
				hctx.fillText(value, hud.width / 8 * 2 + 12, index * 12);
			});

			if (mapHoverLocation.coordinates) {
				const crds = mapHoverLocation.coordinates;

				hctx.textAlign = "right";
				hctx.textBaseline = "middle";

				if (mapHoverLocation.tile.toString()) {
					hctx.fillText(mapHoverLocation.tile.toString(), hud.width - 12, hud.height - 12);
					hctx.fillText(`(${crds.x}, ${crds.y})`, hud.width - 12, hud.height - 24);
				} else {
					hctx.fillText(`(${crds.x}, ${crds.y})`, hud.width - 12, hud.height - 12);
				}
			}

			const keys = players[currentTurn].keys;
			hctx.textAlign = "left";
			hctx.textBaseline = "middle";
			hctx.fillText(`Has ${keys} key${keys === 1 ? "" : "s"}, facing ${directions[players[currentTurn].direction]}`, hud.width / 8 * 2 + 12, hud.height - 12);

			// AGAIN!
			window.requestAnimationFrame(render);
		}

		window.requestAnimationFrame(render);
	} catch (e) {
		alert(e.stack);
	}
})();
