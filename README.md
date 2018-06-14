# Tiny Sandbox

A small game in a small arena.

## Setup

To set up this game so it is playable, you must first clone it:

    git clone https://github.com/Tiny-Sandbox/Tiny-Sandbox.git
    cd Tiny-Sandbox

Afterwards, bundle it using a script:

    npm run bundle

You can now open `index.html` with your favorite browser and you can play.

## Installing Add-ons

Tiles are available using an add-on system, which is as easy as installing a module, adding a line to a file, and re-bundling. Add-ons are usually available with the prefix `tsa` (**T**iny **S**andbox **A**dd-on) on the NPM registry. The basic tiles are available under `tsa-basics`, and will be used as the example for this:

    npm install tsa-basics

Afterwards, open `assets.js` and add this line under where it says to:

    require("tsa-basics"),

If you forget the comma, there may be a syntax error and it will not work. Finally, you can bundle:

    npm run bundle

Go back to your browser and enjoy the new assets you added with an add-on!
