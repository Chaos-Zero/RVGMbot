# Welcome to SD-Bot

This bot is built in order to help with the admin during tournaments on SupraDarky Discord server. 

This project includes a Node.js server script and a web page that connects to it. The front-end page is currenly filler. The intention is to use it to generate brackets on the fly to export to an image to send onto the discord server during tournaments. 

[Node.js](https://nodejs.org/en/about/) is a popular runtime that lets you run server-side JavaScript. This project uses the [express](hhttps://expressjs.com/) web application framework.


## What's in this project?

← `server.js`: The bot set up and main entry into the bot. The methods for setup are extrapolated into `public/main.js`. Most event listening is currently here but will be moved into sperate folders (`events` folder for now). 

← `public/main.js`: The place where the bot setup methods are located. Create, adding commands and registering commands are found here.

← `public/imports.js`: A hack attempt at reducing the ammount of importing methods from other files is required around the code. Just do it all, thnx. 

← `public/commands`: Contains the slash commands module exports, each in it's owm file so they can be automatically added to the bot registing list. 

← `public/events`: This is for capturing specific events from interations on the server. Works the same way as the command directory and more future proofing at the moment. 

← `public/database`: Database methods. Will contain generic and specialised depending on the level of complexity required. Porting from Google sheets or custom files should be in a seperate directory

← `private/testimpl/*`: Misnamed but implementation for future features. Essentially commands not ready to be registered on the bot.


## This code will automatically push to the bot once updated. If there is a cache problem, you can run `refresh` in the terminal