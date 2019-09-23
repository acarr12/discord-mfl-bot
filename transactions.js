'use strict';
const getJSON = require('get-json');
const fetchJSON = require('fetch-json'); 
const _ = require('lodash');

/* XXX move this to main
 * pass into getWaivers as an arg */
const config = require('./franchises.json');

const DAYS = 2
const TRANSACTION_ARGS = `/export?TYPE=transactions&APIKEY=&W=&TRANS_TYPE=BBID_WAIVER&FRANCHISE=&DAYS=${DAYS}&COUNT=&JSON=1&L=`; 
const PLAYERS_ARGS     = '/export?TYPE=players&DETAILS=&SINCE=&JSON=1&PLAYERS=';

/*

{
  timestamp: '1568916000',              // time in seconds GMT
  franchise: '0005',                    // franchise number
  transaction: '14126,|0.00|13634,',    // player added | paid | player dropped
  type: 'BBID_WAIVER'                   // Bid type
}

    {
      franchise2_gave_up: '13189,',
      franchise2: '0003',
      timestamp: '1568696281',
      franchise1_gave_up: '13612,',
      franchise: '0004',
      type: 'TRADE',
      comments: '',
      expires: '1569283200'
    }


*/

function getPlayerString(p) {
    let ret_str = "";
    if (p.position.toUpperCase() !== "DEF") {
	let arr = p.name.split(', ');
	let first = arr[1];
	let last = arr[0];
	ret_str = ` ${first} ${last} `;
    }
    return ret_str + `(${p.position}, ${p.team})`;
}

function getFranchiseName(w) {
    //    let f = franchises.find(f => f.fid === w.franchise)
    let f = config.franchises[w.franchise];
    let string = f.name;

    if (f.handle)
	string = string + " (<@" + f.handle + ">)";

    return string;
}

function get_waiver_string(w, p) {
    //XXX handle w empty, p empty is fine
    let added = _.find(p, { 'id' : w.playerAdded });
    let dropped = _.find(p, { 'id' : w.playerDropped });

    let output_string = `**$${w.bid}** ${getFranchiseName(w)}\n`
                      + '```diff\n'
                      + `+ ${getPlayerString(added)}`;

    if(dropped) {
	output_string += `\n- ${getPlayerString(dropped)}`;
    }
    output_string += '\n```\n';

    return output_string;
}


function fixWaiverT(t) {
    //'14126,|0.00|13634,'
    let arr = t.transaction.split('|');
    let dot = arr[1].indexOf('.');

    if (dot > 0) {
	t.bid       = arr[1].substring(0,dot);
    } else {
	t.bid       = arr[1];
    }
    /* remove trailing commas wtf */
    t.playerAdded   = arr[0].slice(0,-1);
    t.playerDropped = arr[2].slice(0,-1);

    /* now that we've parsed 'transaction' we don't need it */
    delete t['transaction'];

    return t;

}

function process_waivers(t, players) {
    // XXX add case where there are 0 transactions

    if (_.isEmpty(t))
	return [];
    
    let date = new Date();
    let dateString = date.toLocaleDateString("en-US",
					     {weekday: 'short',
					      month: 'numeric',
					      day: 'numeric'});
    let output_string = `:mega: **${dateString} Waivers** :mega:\n\n`;

    

    //    t.reverse().map(x => output_string += get_waiver_string(x, players));
    t.sort(function compare(a,b) {
	return b.bid - a.bid;
    }).map(x => output_string += get_waiver_string(x, players));

    //use trim to eat the last newline
    return output_string.trim(); 
}

async function getPlayerMap(baseURL, w) {
    let p_url = baseURL + PLAYERS_ARGS;
//    let idlist = "";
    
    w.forEach(function(w) {
	p_url += w.playerAdded + "," + w.playerDropped + ",";
    });
    
    return fetchJSON.get(p_url)
	.then(function(response) {
	    var player_json = [];
	    //console.log(response.players.player);
	    return player_json.concat(response.players.player);
	}).catch (function(error) {
	    console.log(error);
	    return [];
	});
}


async function getWaivers(baseURL, leagueID) {
    let t_url = baseURL + TRANSACTION_ARGS + leagueID;
    let waivers = [];
    let playerMap = [];

    console.log(t_url);
    
    let waiverPromise = fetchJSON.get(t_url)
	.then(function(response) {
	    let tmp_w = response.transactions.transaction;

	    if (_.isEmpty(tmp_w))
		return [];
	    
	    /* make sure transaction is for today */
	    if (DAYS == 1) {
		tmp_w = tmp_w.filter (function(transaction) {
		    const today = new Date();
		    const t_stamp = new Date(transaction.timestamp*1000);
		    return today.getDate() == t_stamp.getDate();
		});
	    }
	    return tmp_w.map(fixWaiverT, tmp_w);
	})
	.catch(function(error) {
	    console.log(error);
	    return []
	});
    waivers = await waiverPromise;

    let playerMapPromise = getPlayerMap(baseURL, waivers);
    playerMap = await playerMapPromise;
    
    return process_waivers(waivers, playerMap);
}


//change to run on debug flag
//getWaivers().then(str => console.log(str));

/* not sure where exports go, lets try here */
module.exports.getWaivers = getWaivers;
