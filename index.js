const chroma = require("chroma-js");

function lighten(hex) {
	return chroma(hex).brighten().hex();
}

function tint(hex, hex2, percent = 0.25) {
	return chroma.mix(chroma(hex), chroma(hex2), percent);
}

const indOn = new Image();
indOn.src = "https://vignette.wikia.nocookie.net/minecraft/images/d/db/Redstone_lamp_.jpg/revision/latest?cb=20150826232718";

const assign = require("lodash.assign");
const assets = require("./package.json")["tiny-sandbox"].assets;

function tryRequire(name) {
	try {
		return require(name);
	} catch (error) {
		switch (error.code) {
			case "MODULE_NOT_FOUND": {
				alert(`Could not find ${name}. Please make sure you installed it with NPM!`);
				break;
			}
			default: {
				if (error.code) {
					alert(`An error (${error.code}) occured while trying to load ${name}: ${error.message}`)
				} else {
					alert(`An error occured while trying to load ${name}: ${error.message}`);
				}
			}
		}
	}
}

const externalTiles = assets.map(name => {
	const prettyName = name.startsWith("tsa-") ? name : "tsa-" + name;
	const pkg = tryRequire(prettyName);
	return pkg.tiles;
});

const tileTypes = assign({}, ...externalTiles);

const game = async () => {
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

		function generateRandomTile(x, y) {
			return new Space(x, y);
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
						arr[i][j] = generateRandomTile(j, i);
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

			neighbor(tile, dirTo) {
				const x = tile.position.x;
				const y = tile.position.y;

				try {
					switch (dirTo) {
						case 3:
							return this.getTile(x + 1, y);
						case 2:
							return this.getTile(x, y + 1);
						case 1:
							return this.getTile(x - 1, y);
						default:
							return this.getTile(x, y - 1);
					}
				} catch (error) {
					return false;
				}
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

		const tileDensity = 32;

		function resizeCanvases() {
			canvas.width = arenaWidth * tileDensity;
			canvas.height = arenaHeight * tileDensity;

			hud.width = window.innerWidth * 0.80;
			hud.height = window.innerHeight * 0.15;

			canvas.style.width = window.innerWidth * 0.80 + "px";
			canvas.style.height = window.innerHeight * 0.80 + "px";
		}

		resizeCanvases();
		window.addEventListener("resize", resizeCanvases);

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

			const tile = arenaMap.getTile(pos.x, pos.y);
			const tileActual = event.shiftKey ? tile.oldTile : tile;
			mapHoverLocation = {
				coordinates: pos,
				tile: tileActual,
				frontTile: tile,
				oldTile: tile.oldTile,
				isOldTile: event.shiftKey,
			};
		});
		canvas.addEventListener("mousedown", event => {
			mapHoverLocation.frontTile.changeTo(generateRandomTile(mapHoverLocation.frontTile.position.x, mapHoverLocation.frontTile.position.y));
		});
		let editorMode = false;

		window.addEventListener("keydown", (event) => {
			if (event.code === "KeyP") {
				editorMode = !editorMode;
				return;
			} else if (event.code === "ArrowLeft" && editorMode) {
				hudScroll += 1;
				return;
			} else if (event.code === "ArrowRight" && editorMode) {
				hudScroll -= 1;
				return;
			}

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

		function renderSquare(x, y, color, context = ctx) {
			context.fillStyle = color;
			context.fillRect(x * tileDensity, y * tileDensity, tileDensity, tileDensity);
		}

		function untranslate(context, x, y) {
			context.translate(x * -1, y * -1);
		}

		function renderTile(tile, context = ctx, renderings = tile.getRendering()) {
			const oldStyle = context.fillStyle;
			const x = tile.position.x;
			const y = tile.position.y;

			if (renderings) {
				switch (renderings.type) {
					case "color":
					{
						renderSquare(x, y, renderings.color, context);
						break;
					}
					case "image":
					{
						context.drawImage(renderings.image, x * tileDensity, y * tileDensity, tileDensity, tileDensity);
					}
				}
			}

			context.fillStyle = oldStyle;
			return;
		}

		let hudScroll = 0;
		hudScroll = 0;

		const spacing = 100;

		function renderHUD() {
			// Clear the HUD.
			hctx.fillStyle = "#222222";
			hctx.fillRect(0, 0, hud.width, hud.height);
			if (editorMode) {


				hctx.font = `${hud.height * 0.06}px Ubuntu`;
				hctx.textAlign = "center";
				hctx.textBaseline = "middle";
				hctx.fillStyle = "white";

				tileTypes.forEach((value, index) => {
					const thisOne = value;
					const instance = new thisOne();

					const xPos = index * spacing + hud.width / 2 - ((tileTypes.length - 1) * (spacing / 2));

					hctx.translate(xPos + hudScroll * spacing, hud.height / 2 - tileDensity / 1.5);
					hctx.scale(1.5, 1.5);

					renderTile(instance, hctx, instance.getPreviewRendering());
					hctx.fillText(instance.constructor.name, tileDensity / 2, hud.height / 2 + tileDensity);

					hctx.scale(1 / 1.5, 1 / 1.5);
					untranslate(hctx, xPos + hudScroll * spacing, hud.height / 2 - tileDensity / 1.5);
				});


			} else {
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

					if (mapHoverLocation.isOldTile && mapHoverLocation.tile && mapHoverLocation.tile.toString()) {
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
			}
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

			renderHUD();

			// AGAIN!
			window.requestAnimationFrame(render);
		}
		window.requestAnimationFrame(render);
	} catch (e) {
		alert(e.stack);
	}
};
game();