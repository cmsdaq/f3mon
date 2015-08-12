#!/bin/env node
var daemon = require("daemonize2").setup({
            main: process.argv[3]+"/app.js",
            name: process.argv[6],
            pidfile: process.argv[7],
            argv: [process.argv[4],process.argv[5]],
            cwd : process.argv[3],
            user : "root"
            });

var console = require("console")


console.log(process.argv);

switch (process.argv[2]) {


        case "start":
                daemon.start();
                break;

        case "stop":
                daemon.stop();
                break;

        default:
                console.log("Usage: [start|stop]");
}
