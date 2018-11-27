const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const DEFAULT_GUY = require('../config');
const LEAGUE_KEY = require('../config/keys');

const app = express();


app.use(bodyParser.urlencoded({ extended: true }));
app.use( bodyParser.json() );
app.use(cors());


const port = process.env.PORT || 5000;

app.listen(port, ()=>{
    console.log('Listening on the ' + port);
});


app.get('/', getSummonerMatches);




async function getSummonerMatches(req, response) {
  let summonerName = "";
  let page = 0;
  if(req && req.query && req.query.summonerName){
    summonerName = req.query.summonerName;
    page = req.query.page ? parseInt(req.query.page) : 0;
  }
  console.log("Request for summoner", summonerName)
  let matchesInfo = {};
  matchesInfo.summonerName = summonerName ? summonerName : DEFAULT_GUY;
  matchesInfo.matches = [];
  const summonerInfo = await axios.get("https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/"+ matchesInfo.summonerName + "?api_key="+LEAGUE_KEY, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });
  matchesInfo.accountID = summonerInfo.data.accountId;
  const matchesList = await axios.get("https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/"+matchesInfo.accountID+"?api_key="+LEAGUE_KEY, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });

  if(page === 0 || page === 1){
    page = 0;
  }else{
    page--;
  }
  let currentMatchNumber = page*10;
  let limit = (page*10) + 10;
  let matchesCount =  matchesList.data.matches.length;
  if(currentMatchNumber > matchesCount){
    currentMatchNumber = matchesCount - 10;
    limit = matchesCount;
  }

  if(limit > matchesCount){
    limit = matchesCount;
  }

  for(; currentMatchNumber < limit; currentMatchNumber++){
    matchesInfo.matches.push({
      gameId:matchesList.data.matches[currentMatchNumber].gameId
    });
  }

  const matchData = await matchesInfo.matches.map((match)=>{
    return axios.get("https://na1.api.riotgames.com/lol/match/v3/matches/"+match.gameId+"?api_key="+LEAGUE_KEY, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
  });

  const matchesRawData = await Promise.all(matchData);

  const matchesFilteredData = await matchesRawData.map(match=>{
    let matchStats = {};
    matchStats.gameDuration = match.data.gameDuration;
    match.data.participantIdentities.some((playerData) => {
      if(playerData.player.summonerName.toLowerCase() === matchesInfo.summonerName.toLowerCase()){
        matchesInfo.summonerName = playerData.player.summonerName;
        matchStats.participantId = playerData.participantId;
        return true;
      }
    });
    let summonerDataFromMatch = match.data.participants.some((participant)=>{
      if(participant.participantId === matchStats.participantId){
          matchStats = {...matchStats,
              championId: participant.championId,
              champLevel: participant.stats.champLevel,
              creepScore: participant.stats.totalMinionsKilled + participant.stats.neutralMinionsKilled,
              win: participant.stats.win,
              kda: {
                kills: participant.stats.kills,
                deaths: participant.stats.deaths,
                assists: participant.stats.assists,
              },
              spell1Id: participant.spell1Id,
              spell2Id: participant.spell2Id,
              primaryRune: participant.stats.perkPrimaryStyle,
              secondaryRune: participant.stats.perkSubStyle,
              item0: participant.stats.item0,
              item1: participant.stats.item1,
              item2: participant.stats.item2,
              item3: participant.stats.item3,
              item4: participant.stats.item4,
              item5: participant.stats.item5,
              item6: participant.stats.item6
          };
          return true;
      }
    });
    return matchStats;
  });
  matchesInfo.matches = matchesFilteredData;
  response.send(matchesInfo)
}
