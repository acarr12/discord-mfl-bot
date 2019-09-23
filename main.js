/* npm imports */
const Discord = require('discord.js');
const _       = require('lodash');

/* local imports */
const config  = require('./config.json');
const transactions = require('./transactions');


const client = new Discord.Client();

client.once('ready', () => {
    console.log('Ready!');
});

client.on('message', message => {

    if (message.content === '!ping') {
	message.channel.send('pong.');
    }
    else if (message.content === '!waivers') {
	transactions.getWaivers(config.leagueBaseURL, config.MFLleagueID)
	    .then(function(str) {
		message.channel.send(str);
	    })
	    .catch(function(error) {
		console.log(error);
	    });
    }
});

client.login(config.token);


