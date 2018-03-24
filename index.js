const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

ctx.fillText("Hello there! Something might've gone wrong.", canvas.width / 2, canvas.height / 2);

const hud = document.getElementById("hud");
const hctx = hud.getContext("2d");

let mapHoverLocation = {};

const arenaWidth = 20;
const arenaHeight = 20;

const pixelsPerTile = 4;
canvas.width = arenaWidth * pixelsPerTile;
canvas.height = arenaHeight * pixelsPerTile;

hud.width = window.innerWidth * 0.80;
hud.height = window.innerHeight * 0.15;

canvas.style.width = window.innerWidth * 0.80 + "px";
canvas.style.height = window.innerHeight * 0.80 + "px";

// derived from https://stackoverflow.com/a/901144
function param(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

let currentTurn = 0;
const playerCount = param("players") || 3;
const sandbox = param("sandbox") == true;

let inputs = ["KeyW", "KeyA", "KeyS", "KeyD", "Spacebar"];

class Player {
  constructor(id, x, y) {
		this.id = id;
    
    this.x = x;
    this.y = y;
    
    this.color = `hsl(${this.id / playerCount * 360}, 50%, 50%)`;
  }
}

class Space {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.color = "white";
    this.oldTile = null;
  }

  changeTo(newSpace) {
    newSpace.x = this.x;
    newSpace.y = this.y;
    newSpace.oldTile = this;
    arenaMap[this.y][this.x] = newSpace;
  }

  collides() {
    return false; // Spaces don't collide!! 
  }

  changeBack() {
    if (this.oldTile) {
      this.changeTo(this.oldTile);
      return true;
    } else {
      return false; // Can't change back if there wasn't a tile to revert to.
    }
  }
  
  toString() {
  	return this.constructor.name;
  }
}

class Wall extends Space {
  constructor(x, y) {
    super(x, y);
    this.color = "black";
  }

  collides() {
    return true; // Walls are walls...
  }
}

class Occupied extends Wall {
  constructor(player, x, y) {
    super(x, y);
    this.occupiedBy = player;
    this.color = player.color;
  }
  
  toString() {
  	return `Player ${this.occupiedBy.id + 1}'s tile`;
  }
}

class LockedWall extends Wall {
  constructor(x, y) {
    super(x, y);
    this.color = "#222222";
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

class ItemBox extends Space {

}

function makeArray(w, h) {
  var arr = [];
  for (i = 0; i < h; i++) {
    arr[i] = [];
    for (j = 0; j < w; j++) {
      const random = Math.round(Math.random() * 20);
      arr[i][j] = (function() {
        switch (random) {
          case 0:
            return new LockedWall(j, i);
          case 1:
          case 2:
            return new Wall(j, i);
          case 3:
          	return new DirectionalWall(Math.round(Math.random() * 4), j, i);
          default:
            return new Space(j, i);
        }
      })();
    }
  }
  return arr;
}
const arenaMap = makeArray(arenaWidth, arenaHeight);

function getTile(x, y) {
  return arenaMap[y][x];
}

const players = [];
for (let p = 0; p < playerCount; p++) {
  const playerX = Math.round(Math.random() * arenaWidth);
  const playerY = Math.round(Math.random() * arenaHeight);

  players.push(new Player(p, playerX, playerY));

  getTile(playerX, playerY).changeTo(new Occupied(players[p]));
}

function getMousePos(evt) {
  var rect = canvas.getBoundingClientRect(), // abs. size of element
    scaleX = canvas.width / rect.width, // relationship bitmap vs. element for X
    scaleY = canvas.height / rect.height; // relationship bitmap vs. element for Y

  return {
    x: Math.floor((evt.clientX - rect.left) * scaleX / pixelsPerTile), // scale mouse coordinates after they have
    y: Math.floor((evt.clientY - rect.top) * scaleY / pixelsPerTile) // been adjusted to be relative to element
  }
}

canvas.addEventListener("mousemove", (event) => {
	const pos = getMousePos(event);
  mapHoverLocation = {
  	coordinates: pos,
    tile: getTile(pos.x, pos.y),
  };
});

window.addEventListener("keypress", (event) => {
  const curPl = players[currentTurn];
  let curTile = getTile(curPl.x, curPl.y);

  let finishedTurn = true; // Only set to false if none of the keys with a case below were pressed or failed move.

  switch (event.code) {
    case inputs[0]:
      const tileUp = getTile(curPl.x, curPl.y - 1);
      if (!tileUp.collides(2) || (event.sandbox && event.shiftKey)) {
        curTile.changeBack();
        tileUp.changeTo(curTile);
        players[currentTurn].y--;
      } else {
        finishedTurn = false;
      }
      break;
    case inputs[1]:
      const tileLeft = getTile(curPl.x - 1, curPl.y);
      if (!tileLeft.collides(3) || (event.sandbox && event.shiftKey)) {
        curTile.changeBack();
        tileLeft.changeTo(curTile);
        players[currentTurn].x--;
      } else {
        finishedTurn = false;
      }
      break;
    case inputs[2]:
      const tileDown = getTile(curPl.x, curPl.y + 1);
      if (!tileDown.collides(0) || (event.sandbox && event.shiftKey)) {
        curTile.changeBack();
        tileDown.changeTo(curTile);
        players[currentTurn].y++;
      } else {
        finishedTurn = false;
      }
      break;
    case inputs[3]:
      const tileRight = getTile(curPl.x + 1, curPl.y);
      if (!tileRight.collides(1) || (event.sandbox && event.shiftKey)) {
        curTile.changeBack();
        tileRight.changeTo(curTile);
        players[currentTurn].x++;
      } else {
        finishedTurn = false;
      }
      break;
    default:
      finishedTurn = false;
  }
  if (finishedTurn) {
    currentTurn++;
    if (currentTurn === players.length) {
      currentTurn = 0;
    }
  }
});

function tile(x = 0, y = 0, fillStyle = "white") {
  const oldStyle = ctx.fillStyle;
  ctx.fillStyle = fillStyle;

  ctx.fillRect(x * pixelsPerTile, y * pixelsPerTile, pixelsPerTile, pixelsPerTile);

  ctx.fillStyle = oldStyle;
  return;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < arenaHeight; y++) {
    for (let x = 0; x < arenaWidth; x++) {
      const curTile = arenaMap[y][x];
      tile(curTile.x, curTile.y, curTile.color);
    }
  }

  // Clear the HUD.
  hctx.fillStyle = "#222222";
  hctx.fillRect(0, 0, hud.width, hud.height);

  // Get some HUD backgrounds.
  hctx.fillStyle = players[currentTurn].color;
  hctx.fillRect(0, 0, hud.width / 4, hud.height);

  // Cool font and color.
  hctx.font = `${hud.width / 20}px Ubuntu`;
  hctx.fillStyle = "white";

  // Center text.
  hctx.textAlign = "center";
  hctx.textBaseline = "middle";

  // Render some HUD stats.
  const playerText = sandbox ? "SANDBOX" : `PLAYER ${currentTurn + 1}`;
  hctx.fillText(playerText, hud.width / 8, hud.height / 2);

  hctx.font = "12px Ubuntu";
  hctx.textAlign = "left";
  hctx.textBaseline = "top";

  const text = "Use WASD to navigate.\nEach player takes turns moving.\nYou can only move to tiles that are white (empty spaces).\nThere is no objective yet.\nHave fun!".split("\n");

  text.forEach((value, index) => {
    hctx.fillText(value, hud.width / 8 * 2 + 12, index * 12);
  });
  
  if (mapHoverLocation.coordinates) {
  	const crds = mapHoverLocation.coordinates;
    
  	hctx.textAlign = "right";
  	hctx.textBaseline = "middle";
  
  	hctx.fillText(`(${crds.x}, ${crds.y})`, hud.width - 12, hud.height - 12);
  	hctx.fillText(mapHoverLocation.tile.toString(), hud.width - 12, hud.height - 24);
  }

  // AGAIN!
  window.requestAnimationFrame(render);
}

window.requestAnimationFrame(render);
