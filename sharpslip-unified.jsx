import { useState, useRef, useEffect } from "react";

// ── COLORS ──────────────────────────────────────────────────────────────────
var BG="#080d18", CARD="#101928", CARD2="#151f30", CARD3="#1a2640";
var BORDER="#1e2d47", BORDER2="#253550";
var ACCENT="#4d9fff", ACCENT2="#2979d4";
var TEXT="#dce8f7", TEXT2="#8ba4c2", MUTED="#4a607a";
var POS_C="#34d399", NEG_C="#ff5a5a", WARN_C="#fbbf24";
var HOT_C="#ff6b2b", COLD_C="#7dd4fc";
var AGL="rgba(77,159,255,0.12)";

// ── TEAM COLORS ──────────────────────────────────────────────────────────────
var TEAM_C={
  NYY:"#003087",BOS:"#BD3039",LAD:"#005A9C",SF:"#FD5A1E",
  HOU:"#EB6E1F",ATL:"#CE1141",TOR:"#134A8E",BAL:"#DF4601",
  TEX:"#003278",TB:"#092C5C",PHI:"#E81828",NYM:"#002D72",
  MIA:"#00A3E0",MIL:"#FFC52F",CHC:"#0E3386",STL:"#C41E3A",
  CIN:"#C6011F",PIT:"#FDB827",ARI:"#A71930",SD:"#2F241D",
  COL:"#333366",SEA:"#0C2C56",LAA:"#BA0021",OAK:"#003831",
  MIN:"#002B5C",CWS:"#27251F",CLE:"#00385D",DET:"#0C2340",
  KC:"#004687",WSH:"#AB0003"
};

// ── CSS ───────────────────────────────────────────────────────────────────────
var APP_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');\n",
  "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}\n",
  "body{background:#080d18;color:#dce8f7;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}\n",
  "::-webkit-scrollbar{display:none;}\n",
  "@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}\n",
  "@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}\n",
  "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}\n",
  "@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}\n",
].join("");

// ── DATA ──────────────────────────────────────────────────────────────────────
var NAV = [
  {id:"home",icon:"⌂",label:"Home"},
  {id:"games",icon:"📅",label:"Games"},
  {id:"leaders",icon:"📊",label:"Leaders"},
  {id:"standings",icon:"🏆",label:"Standings"},
  {id:"account",icon:"👤",label:"Account"},
];

var SPORTS = [
  {id:"mlb",icon:"⚾",label:"MLB"},
  {id:"nfl",icon:"🏈",label:"NFL"},
  {id:"nba",icon:"🏀",label:"NBA"},
  {id:"nhl",icon:"🏒",label:"NHL"},
];

var TICKER_ITEMS = [
  {label:"Judge",   cat:"HR",       chg:+26, hot:true },
  {label:"Cole",    cat:"K 8.5+",   chg:+19, hot:true },
  {label:"Soto",    cat:"1+ Hit",   chg:+18, hot:true },
  {label:"Glasnow", cat:"K 9.5+",   chg:-18, hot:false},
  {label:"NYY",     cat:"ATS Home", chg:+18, hot:true },
  {label:"Seager",  cat:"1.5+ TB",  chg:-16, hot:false},
  {label:"BOS",     cat:"Road ATS", chg:-16, hot:false},
  {label:"Freeman", cat:"2+ Hits",  chg:+15, hot:true },
  {label:"BAL",     cat:"Over",     chg:+14, hot:true },
  {label:"Strider", cat:"K 8.5+",   chg:+13, hot:true },
  {label:"Burnes",  cat:"K 6.5+",   chg:-12, hot:false},
  {label:"Olson",   cat:"1.5+ TB",  chg:-12, hot:false},
];

var SLATE_GAMES = [
  {id:1,away:{abbr:"BOS",c:"#BD3039"},home:{abbr:"NYY",c:"#003087"},time:"LIVE",edges:3,total:"8.5",ap:"Bello",hp:"Cole",status:"Live",winProb:62},
  {id:2,away:{abbr:"LAD",c:"#005A9C"},home:{abbr:"SF",c:"#FD5A1E"},time:"9:45 PM",edges:2,total:"7.5",ap:"Glasnow",hp:"Webb",status:"Pre",winProb:55},
  {id:3,away:{abbr:"HOU",c:"#EB6E1F"},home:{abbr:"ATL",c:"#CE1141"},time:"7:20 PM",edges:2,total:"8.0",ap:"Valdez",hp:"Strider",status:"Pre",winProb:52},
  {id:4,away:{abbr:"TOR",c:"#134A8E"},home:{abbr:"BAL",c:"#DF4601"},time:"6:35 PM",edges:1,total:"9.0",ap:"Gausman",hp:"Means",status:"Pre",winProb:48},
  {id:5,away:{abbr:"TEX",c:"#003278"},home:{abbr:"TB",c:"#092C5C"},time:"6:40 PM",edges:1,total:"7.5",ap:"Dunning",hp:"McClanahan",status:"Pre",winProb:51},
];

var FEATURED_EDGE = {
  icon:"⚾", grade:"A", conf:82,
  bet:"Gerrit Cole Over 8.5 K",
  why:"Cole has cleared 8.5 Ks in 6 of his last 8 starts. Tonight he faces a BOS lineup striking out at 28.1% on the road vs RHP — the highest rate in the AL over the last 14 days.",
  stats:[
    {label:"Cole K/9",val:"11.4",good:true},
    {label:"BOS K Rate",val:"28.1%",good:true},
    {label:"L8 streak",val:"6/8",good:true},
    {label:"Ump adj",val:"-2.2%",good:false},
  ],
  line:"Cole K 8.5+ · DK -118",
};

var HOME_GROUPS = {
  Hitters:  ["hits","tb","hr","walks"],
  Pitchers: ["strikeouts","innings"],
  Teams:    ["ats","ou","nrfi"],
};

function makePlayers(hotNames, coldNames, chgHot, chgCold) {
  var hot = hotNames.map(function(n, i) {
    return {name:n.name, team:n.team, chg:chgHot - i*2, streak:Math.max(1,4-i)};
  });
  var cold = coldNames.map(function(n, i) {
    return {name:n.name, team:n.team, chg:-(chgCold - i*2), streak:-Math.max(1,4-i)};
  });
  return {hot:hot, cold:cold};
}

var HOT_H = [{name:"Juan Soto",team:"NYY"},{name:"Rafael Devers",team:"BOS"},{name:"Freddie Freeman",team:"LAD"},{name:"Yordan Alvarez",team:"HOU"},{name:"Aaron Judge",team:"NYY"},{name:"Mookie Betts",team:"LAD"},{name:"Shohei Ohtani",team:"LAD"},{name:"Bobby Witt Jr.",team:"KC"},{name:"Jose Ramirez",team:"CLE"},{name:"Trea Turner",team:"PHI"},{name:"Pete Alonso",team:"NYM"},{name:"Gunnar Henderson",team:"BAL"},{name:"Michael Harris",team:"ATL"},{name:"Adolis Garcia",team:"TEX"},{name:"Vladimir Guerrero Jr.",team:"TOR"}];
var COLD_H = [{name:"Corey Seager",team:"TEX"},{name:"Matt Olson",team:"ATL"},{name:"Bo Bichette",team:"TOR"},{name:"Willson Contreras",team:"STL"},{name:"Anthony Santander",team:"BAL"},{name:"Adley Rutschman",team:"BAL"},{name:"Xander Bogaerts",team:"SD"},{name:"Ezequiel Tovar",team:"COL"},{name:"Jake Cronenworth",team:"SD"},{name:"Joey Votto",team:"CIN"},{name:"Daulton Varsho",team:"TOR"},{name:"Evan Longoria",team:"ARI"},{name:"Josh Bell",team:"CLE"},{name:"Kyle Tucker",team:"HOU"},{name:"Joc Pederson",team:"SF"}];

var HOME_PROPS = {
  hits:{label:"Hits",icon:"🎯",group:"Hitters",lines:{
    "1+":makePlayers(HOT_H,COLD_H,22,16),
    "2+":makePlayers(HOT_H.slice(1),COLD_H.slice(1),18,13),
  }},
  tb:{label:"Total Bases",icon:"📐",group:"Hitters",lines:{
    "1.5+":makePlayers(HOT_H,COLD_H,26,18),
    "2.5+":makePlayers(HOT_H.slice(1),COLD_H.slice(1),20,14),
  }},
  hr:{label:"Home Run",icon:"💣",group:"Hitters",lines:{
    "Anytime":makePlayers(HOT_H,COLD_H,26,16),
    "2+ TB":makePlayers(HOT_H.slice(2),COLD_H.slice(2),18,12),
  }},
  walks:{label:"Walks",icon:"🚶",group:"Hitters",lines:{
    "0.5+":makePlayers(HOT_H,COLD_H,20,14),
    "1+":makePlayers(HOT_H.slice(1),COLD_H.slice(1),16,11),
  }},
  strikeouts:{label:"Strikeouts",icon:"⚾",group:"Pitchers",lines:{
    "4.5+":makePlayers(HOT_H,COLD_H,22,16),
    "5.5+":makePlayers(HOT_H.slice(1),COLD_H.slice(1),18,13),
  }},
  innings:{label:"Innings",icon:"⏱",group:"Pitchers",lines:{
    "5+":makePlayers(HOT_H,COLD_H,20,14),
    "6+":makePlayers(HOT_H.slice(2),COLD_H.slice(2),16,11),
  }},
  ats:{label:"ATS / Run Line",icon:"📈",group:"Teams",lines:{
    "-1.5":{hot:[{name:"New York Yankees",team:"NYY",chg:+18,streak:5},{name:"Los Angeles Dodgers",team:"LAD",chg:+15,streak:4},{name:"Houston Astros",team:"HOU",chg:+12,streak:3},{name:"Atlanta Braves",team:"ATL",chg:+10,streak:3},{name:"Baltimore Orioles",team:"BAL",chg:+8,streak:2},{name:"Philadelphia Phillies",team:"PHI",chg:+7,streak:2},{name:"Tampa Bay Rays",team:"TB",chg:+6,streak:2},{name:"Seattle Mariners",team:"SEA",chg:+5,streak:1},{name:"Cleveland Guardians",team:"CLE",chg:+4,streak:1},{name:"Minnesota Twins",team:"MIN",chg:+4,streak:1},{name:"San Diego Padres",team:"SD",chg:+3,streak:1},{name:"Toronto Blue Jays",team:"TOR",chg:+3,streak:1},{name:"Boston Red Sox",team:"BOS",chg:+2,streak:1},{name:"Miami Marlins",team:"MIA",chg:+2,streak:1},{name:"Kansas City Royals",team:"KC",chg:+1,streak:1}],cold:[{name:"Oakland Athletics",team:"OAK",chg:-19,streak:-5},{name:"Colorado Rockies",team:"COL",chg:-16,streak:-4},{name:"Chicago White Sox",team:"CWS",chg:-14,streak:-4},{name:"Washington Nationals",team:"WSH",chg:-12,streak:-3},{name:"Cincinnati Reds",team:"CIN",chg:-10,streak:-3},{name:"Pittsburgh Pirates",team:"PIT",chg:-9,streak:-2},{name:"Arizona Diamondbacks",team:"ARI",chg:-8,streak:-2},{name:"Detroit Tigers",team:"DET",chg:-7,streak:-2},{name:"Los Angeles Angels",team:"LAA",chg:-6,streak:-2},{name:"San Francisco Giants",team:"SF",chg:-5,streak:-1},{name:"St. Louis Cardinals",team:"STL",chg:-4,streak:-1},{name:"Chicago Cubs",team:"CHC",chg:-4,streak:-1},{name:"New York Mets",team:"NYM",chg:-3,streak:-1},{name:"Milwaukee Brewers",team:"MIL",chg:-2,streak:-1},{name:"Texas Rangers",team:"TEX",chg:-2,streak:-1}]},
    "+1.5":{hot:[{name:"Oakland Athletics",team:"OAK",chg:+19,streak:5},{name:"Colorado Rockies",team:"COL",chg:+16,streak:4},{name:"Chicago White Sox",team:"CWS",chg:+14,streak:4},{name:"Washington Nationals",team:"WSH",chg:+12,streak:3},{name:"Cincinnati Reds",team:"CIN",chg:+10,streak:3},{name:"Pittsburgh Pirates",team:"PIT",chg:+9,streak:2},{name:"Arizona Diamondbacks",team:"ARI",chg:+8,streak:2},{name:"Detroit Tigers",team:"DET",chg:+7,streak:2},{name:"Los Angeles Angels",team:"LAA",chg:+6,streak:2},{name:"San Francisco Giants",team:"SF",chg:+5,streak:1},{name:"St. Louis Cardinals",team:"STL",chg:+4,streak:1},{name:"Chicago Cubs",team:"CHC",chg:+4,streak:1},{name:"New York Mets",team:"NYM",chg:+3,streak:1},{name:"Milwaukee Brewers",team:"MIL",chg:+2,streak:1},{name:"Texas Rangers",team:"TEX",chg:+2,streak:1}],cold:[{name:"New York Yankees",team:"NYY",chg:-18,streak:-5},{name:"Los Angeles Dodgers",team:"LAD",chg:-15,streak:-4},{name:"Houston Astros",team:"HOU",chg:-12,streak:-3},{name:"Atlanta Braves",team:"ATL",chg:-10,streak:-3},{name:"Baltimore Orioles",team:"BAL",chg:-8,streak:-2},{name:"Philadelphia Phillies",team:"PHI",chg:-7,streak:-2},{name:"Tampa Bay Rays",team:"TB",chg:-6,streak:-2},{name:"Seattle Mariners",team:"SEA",chg:-5,streak:-1},{name:"Cleveland Guardians",team:"CLE",chg:-4,streak:-1},{name:"Minnesota Twins",team:"MIN",chg:-4,streak:-1},{name:"San Diego Padres",team:"SD",chg:-3,streak:-1},{name:"Toronto Blue Jays",team:"TOR",chg:-3,streak:-1},{name:"Boston Red Sox",team:"BOS",chg:-2,streak:-1},{name:"Miami Marlins",team:"MIA",chg:-2,streak:-1},{name:"Kansas City Royals",team:"KC",chg:-1,streak:-1}]},
  }},
  ou:{label:"Over / Under",icon:"🎰",group:"Teams",lines:{
    "Over":makePlayers(HOT_H,COLD_H,14,12),
    "Under":makePlayers(COLD_H,HOT_H,14,12),
  }},
  nrfi:{label:"NRFI / YRFI",icon:"0️⃣",group:"Teams",lines:{
    "NRFI":makePlayers(HOT_H,COLD_H,18,14),
    "YRFI":makePlayers(COLD_H,HOT_H,18,14),
  }},
};

var LEADER_CATS = ["1+ Hits","2+ Hits","1+ TB","HR","K 5.5+","K 6.5+","K 7.5+","K 8.5+"];
var LEADERS_DATA = {
  "1+ Hits":{
    recent:[
      {rank:1,name:"Juan Soto",team:"NYY",val:".412",chg:+22,hot:true},
      {rank:2,name:"Rafael Devers",team:"BOS",val:".389",chg:+18,hot:true},
      {rank:3,name:"Freddie Freeman",team:"LAD",val:".371",chg:+14,hot:true},
    ],
    season:[
      {rank:1,name:"Freddie Freeman",team:"LAD",val:".331",chg:+8,hot:true},
      {rank:2,name:"Juan Soto",team:"NYY",val:".318",chg:+6,hot:true},
      {rank:3,name:"Rafael Devers",team:"BOS",val:".299",chg:+4,hot:true},
    ]
  }
};

// ── GAME BREAKDOWN DATA ───────────────────────────────────────────────────────
var GAME_DATA = {
  away:{abbr:"BOS",full:"Boston Red Sox",c:"#BD3039"},
  home:{abbr:"NYY",full:"New York Yankees",c:"#003087"},
  venue:"Yankee Stadium",
  status:"Live",
  score:{away:3,home:5},
  inning:"6th",
  winProb:{away:38,home:62},
  awayP:{name:"Brayan Bello",era:"3.84",fip:"4.18",xfip:"4.61",siera:"4.44",k9:"8.4",bb9:"3.2",whip:"1.28",csw:"27.4",kbb:"12.8",avgIP:"5.4",hardHitPct:"42.8",barrelPct:"9.4",exitVelo:"91.8",gbPct:"42.1",strandPct:"68.4",pitches:{fb:"52.1%",sl:"24.8%",ch:"14.4%",cb:"8.7%"},veloAvg:"95.2 mph",veloTrend:"-0.4 mph"},
  homeP:{name:"Gerrit Cole",era:"2.91",fip:"2.44",xfip:"2.88",siera:"2.76",k9:"11.4",bb9:"1.8",whip:"0.97",csw:"34.1",kbb:"22.8",avgIP:"6.8",hardHitPct:"28.2",barrelPct:"4.1",exitVelo:"87.3",gbPct:"38.4",strandPct:"82.1",pitches:{ff:"54.2%",sl:"21.3%",ch:"15.8%",cu:"8.7%"},veloAvg:"97.1 mph",veloTrend:"+0.3 mph"},
};

var TRENDS_DATA = [
  {id:1,hot:true, title:"NYY 7-1 in last 8 home games",team:"NYY",cat:"Form",body:"Scoring 6.2 R/G at Yankee Stadium. Team wRC+ of 118 at home vs 94 on the road."},
  {id:2,hot:false,title:"BOS 2-7 in last 9 road games",team:"BOS",cat:"Form",body:"Averaging just 3.1 R/G away. .218 team AVG, 28.1% K rate on the road this month."},
  {id:3,hot:true, title:"Cole dominant vs BOS — 0.94 ERA",team:"NYY",cat:"Pitching",body:"Cole: 0.94 ERA, 38 K in 28.2 IP vs BOS. CSW% of 34.1% vs this lineup — elite."},
  {id:4,hot:false,title:"Bello struggling — FIP gap alarming",team:"BOS",cat:"Pitching",body:"Bello ERA 3.84 but xFIP 4.61. Allowing 42% hard contact. Regression risk tonight."},
  {id:5,hot:false,title:"BOS bullpen taxed — 3 of last 4 nights",team:"BOS",cat:"Bullpen",body:"Martin & Winckowski pitched yesterday. Bullpen health 62/100. ERA 4.21 last 7 days."},
  {id:6,hot:true, title:"Yankee Stadium HR factor: 121",team:"NYY",cat:"Ballpark",body:"Wind blowing IN tonight. LHH have 40% higher HR rate here. Favors Judge, Soto, Stanton."},
  {id:7,hot:false,title:"Tight zone umpire — Hernandez",team:"NYY",cat:"Umpire",body:"K rate 2.2% below avg. CSW% context drops ~1.8 pts. Lean toward pitcher K unders."},
  {id:8,hot:true, title:"NYY 12-4 ATS last 16 home vs BOS",team:"NYY",cat:"H2H",body:"NYY outscoring BOS 46-29 in last 10. Cole starts: NYY 8-2 in last 10 H2H."},
  {id:9,hot:false,title:"BOS BABIP luck running out",team:"BOS",cat:"Betting",body:"BOS .342 BABIP last 14 days vs .301 career avg. Regression incoming. NYY ML value."},
];

var EDGES = [
  {id:1,bet:"NYY Money Line",type:"side",team:"NYY",grade:"A",conf:100,supporting:8,line:"DK: NYY -148",analysis:"Cole's ERA-FIP alignment signals genuine dominance, not luck. The BOS bullpen is taxed and their lineup has the highest K rate vs RHP in the AL over the last 14 days. This is a convergence of starter quality, bullpen advantage, and lineup mismatch.",stats:[{label:"Cole ERA",val:"2.91",good:true},{label:"BOS K Rate",val:"28.1%",good:true},{label:"BOS Bullpen",val:"62/100",good:true},{label:"Ump adj",val:"-1.8%",good:false}],factors:[{label:"Cole ERA vs FIP alignment",score:1,weight:9},{label:"BOS road K rate",score:1,weight:8},{label:"NYY home win streak",score:1,weight:7},{label:"BOS bullpen fatigue",score:-1,weight:6},{label:"Umpire zone risk",score:-1,weight:4}]},
  {id:2,bet:"Full Game Under 8.5",type:"total",team:"",grade:"B+",conf:94,supporting:4,line:"DK: Under -108",analysis:"Cole projects for a low-run start with his elite K rate. BOS road offense is suppressed. Wind blowing in reduces HR upside. Bello's deep count tendencies favor fewer runs.",stats:[{label:"Cole K/9",val:"11.4",good:true},{label:"Wind",val:"IN 8mph",good:true},{label:"Bello xFIP",val:"4.61",good:false},{label:"BOS Road OPS",val:".641",good:true}],factors:[{label:"Cole projected Ks",score:1,weight:8},{label:"BOS road offense",score:1,weight:7},{label:"Wind blowing IN",score:1,weight:6},{label:"Bello HR allowed",score:-1,weight:5}]},
  {id:3,bet:"Cole Over 8.5 Ks",type:"props",team:"NYY",grade:"A",conf:100,supporting:9,line:"DK: Over -118",analysis:"Cole has gone over 8.5 Ks in 6 of his last 8 starts. BOS lineup strikes out at 28.1% on the road vs RHP — the highest rate in the AL. Tonight's umpire has a slightly tighter zone but not enough to change the projection.",stats:[{label:"Cole K/9",val:"11.4",good:true},{label:"BOS K Rate",val:"28.1%",good:true},{label:"L8 streak",val:"6/8",good:true},{label:"Ump adj",val:"-2.2%",good:false}],factors:[{label:"Cole CSW% dominance",score:1,weight:9},{label:"BOS road K rate",score:1,weight:8},{label:"Cole avg IP vs BOS",score:1,weight:7},{label:"Umpire zone risk",score:-1,weight:4},{label:"BOS hot bats",score:-1,weight:3}]},
];

var BATTING_DATA = {
  BOS:{
    lineup:[
      {name:"Yoshida, M.",pos:"LF",bats:"L",avg:".298",obp:".368",slg:".441",ops:".809",woba:".348",wrc:118,xba:".271",xslg:".408",hard:38.2,k:14.2,bb:9.8,chase:28.1,whiff:22.4,robAvg:".298",robOps:".812",riscAvg:".311",hot:true},
      {name:"Devers, R.",pos:"3B",bats:"L",avg:".281",obp:".341",slg:".521",ops:".862",woba:".361",wrc:128,xba:".264",xslg:".512",hard:48.1,k:18.2,bb:8.4,chase:32.1,whiff:26.8,robAvg:".284",robOps:".864",riscAvg:".278",hot:true},
      {name:"Casas, T.",pos:"1B",bats:"L",avg:".242",obp:".341",slg:".428",ops:".769",woba:".338",wrc:112,xba:".251",xslg:".428",hard:41.2,k:22.4,bb:12.1,chase:27.4,whiff:24.1,robAvg:".258",robOps:".784",riscAvg:".241",hot:false},
      {name:"O'Neill, T.",pos:"RF",bats:"R",avg:".241",obp:".301",slg:".418",ops:".719",woba:".318",wrc:98,xba:".234",xslg:".441",hard:44.8,k:24.1,bb:7.8,chase:34.2,whiff:28.4,robAvg:".241",robOps:".741",riscAvg:".218",hot:false},
      {name:"Duvall, A.",pos:"LF",bats:"R",avg:".228",obp:".281",slg:".418",ops:".699",woba:".301",wrc:88,xba:".221",xslg:".411",hard:42.8,k:26.4,bb:6.8,chase:36.4,whiff:30.1,robAvg:".244",robOps:".748",riscAvg:".214",hot:false},
    ]
  },
  NYY:{
    lineup:[
      {name:"Judge, A.",pos:"RF",bats:"R",avg:".298",obp:".401",slg:".594",ops:".995",woba:".421",wrc:182,xba:".281",xslg:".571",hard:52.4,k:28.4,bb:18.2,chase:24.1,whiff:28.4,robAvg:".301",robOps:"1.012",riscAvg:".318",hot:true},
      {name:"Soto, J.",pos:"RF",bats:"L",avg:".312",obp:".421",slg:".541",ops:".962",woba:".412",wrc:174,xba:".298",xslg:".524",hard:44.1,k:18.4,bb:21.4,chase:22.4,whiff:18.1,robAvg:".318",robOps:".974",riscAvg:".324",hot:true},
      {name:"Stanton, G.",pos:"DH",bats:"R",avg:".241",obp:".318",slg:".518",ops:".836",woba:".358",wrc:132,xba:".251",xslg:".508",hard:54.8,k:32.4,bb:9.8,chase:28.4,whiff:32.1,robAvg:".248",robOps:".848",riscAvg:".241",hot:false},
      {name:"Rizzo, A.",pos:"1B",bats:"L",avg:".218",obp:".311",slg:".381",ops:".692",woba:".308",wrc:94,xba:".228",xslg:".378",hard:38.4,k:18.4,bb:11.4,chase:29.8,whiff:22.4,robAvg:".224",robOps:".701",riscAvg:".228",hot:false},
    ]
  }
};

var SUMMARY_DATA = {
  away:{
    abbr:"BOS", record:"3-2", winPct:60, coverPct:60,
    avgRG:4.4, allowRG:3.6, avgTotal:7.6, underRate:75,
    avgSpread:1.6, rlRecord:"3/5", impliedTotal:4.3,
    bml:"3-2",bml_p:60,brlm:"2-3",brlm_p:40,brlp:"3-2",brlp_p:60,
    bover:"1-4",bover_p:20,bunder:"4-1",bunder_p:80,bnrfi:"3-2",bnrfi_p:60,
    bf5ml:"2-3",bf5ml_p:40,bf5u:"4-1",bf5u_p:80,
    bttover:"2-3",bttover_p:40,bttunder:"3-2",bttunder_p:60,batsH:"2-1",batsH_p:67,batsA:"1-2",batsA_p:33,
    offenseAvg:".271", offenseOBP:".341", offenseOPS:".768",
    defenseAvg:".248", defenseOBP:".318", defenseOPS:".711",
    form:["W","L","W","W","L"],
    log:[
      {date:"Jun 16",opp:"NYY",wl:"L",venue:"Away",rs:3,ra:5,sp:"Bello",ats:"L",ou:"U"},
      {date:"Jun 14",opp:"NYY",wl:"W",venue:"Away",rs:7,ra:2,sp:"Pivetta",ats:"W",ou:"O"},
      {date:"Jun 12",opp:"TB",wl:"W",venue:"Home",rs:5,ra:3,sp:"Bello",ats:"W",ou:"P"},
      {date:"Jun 11",opp:"TB",wl:"L",venue:"Home",rs:2,ra:4,sp:"Crawford",ats:"L",ou:"U"},
      {date:"Jun 10",opp:"TB",wl:"W",venue:"Home",rs:6,ra:1,sp:"Pivetta",ats:"W",ou:"U"},
    ]
  },
  home:{
    abbr:"NYY", record:"4-1", winPct:80, coverPct:80,
    avgRG:5.6, allowRG:2.8, avgTotal:8.2, underRate:50,
    avgSpread:-1.6, rlRecord:"3/5", impliedTotal:4.1,
    bml:"4-1",bml_p:80,brlm:"3-2",brlm_p:60,brlp:"4-1",brlp_p:80,
    bover:"2-3",bover_p:40,bunder:"3-2",bunder_p:60,bnrfi:"3-2",bnrfi_p:60,
    bf5ml:"3-2",bf5ml_p:60,bf5u:"3-2",bf5u_p:60,
    bttover:"3-2",bttover_p:60,bttunder:"2-3",bttunder_p:40,batsH:"3-1",batsH_p:75,batsA:"1-1",batsA_p:50,
    offenseAvg:".294", offenseOBP:".368", offenseOPS:".841",
    defenseAvg:".221", defenseOBP:".291", defenseOPS:".638",
    form:["W","W","W","L","W"],
    log:[
      {date:"Jun 16",opp:"BOS",wl:"W",venue:"Home",rs:5,ra:3,sp:"Cole",ats:"W",ou:"U"},
      {date:"Jun 14",opp:"BOS",wl:"L",venue:"Home",rs:2,ra:7,sp:"Cortes",ats:"L",ou:"O"},
      {date:"Jun 12",opp:"TB",wl:"W",venue:"Away",rs:4,ra:2,sp:"Cole",ats:"W",ou:"U"},
      {date:"Jun 11",opp:"TB",wl:"W",venue:"Away",rs:6,ra:3,sp:"Schmidt",ats:"W",ou:"O"},
      {date:"Jun 10",opp:"TB",wl:"W",venue:"Away",rs:8,ra:2,sp:"Cole",ats:"W",ou:"O"},
    ]
  }
};

var GLOSSARY = {
  "ERA":{title:"ERA",body:"Earned Run Average. Runs allowed per 9 innings (excluding unearned runs). Lower is better for pitchers."},
  "FIP":{title:"FIP",body:"Fielding Independent Pitching. Measures pitcher performance using only outcomes within their control: Ks, BBs, HRs. A FIP lower than ERA suggests the pitcher is better than their ERA shows."},
  "xFIP":{title:"xFIP",body:"Expected FIP. Normalizes HR rate to league average. Better predictor of future ERA than FIP."},
  "CSW%":{title:"CSW%",body:"Called Strike + Whiff %. The percentage of pitches that result in either a called strike or a swinging strike. Elite is 30%+."},
  "wOBA":{title:"wOBA",body:"Weighted On-Base Average. Assigns different weights to each type of hit/walk based on actual run values. More accurate than OBP."},
  "wRC+":{title:"wRC+",body:"Weighted Runs Created Plus. Park and league adjusted offensive metric. 100 is league average, 120 means 20% better than average."},
};

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────

function ConfBar(props) {
  var pct = props.pct;
  var color = pct >= 80 ? POS_C : pct >= 65 ? ACCENT : WARN_C;
  return (
    <div style={{height:3,borderRadius:2,background:BORDER2,overflow:"hidden",marginTop:4}}>
      <div style={{height:"100%",width:pct+"%",background:color,borderRadius:2,transition:"width .4s ease"}}/>
    </div>
  );
}

function GradeChip(props) {
  var grade = props.grade;
  var color = grade==="A"||grade==="A-" ? POS_C : grade==="B+"||grade==="B" ? ACCENT : WARN_C;
  return (
    <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
      width:22,height:22,borderRadius:6,background:color+"22",
      border:"1px solid "+color+"44",fontSize:11,fontWeight:800,color:color}}>
      {grade}
    </div>
  );
}

function TeamBadge(props) {
  var abbr = props.abbr;
  var c = TEAM_C[abbr] || ACCENT;
  return (
    <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
      background:c+"22",border:"1px solid "+c+"44",color:c}}>
      {abbr}
    </span>
  );
}

function Pill(props) {
  var options = props.options;
  var active = props.active;
  var onChange = props.onChange;
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
      {options.map(function(o) {
        var isActive = active===o;
        return (
          <button key={o} onClick={function(){onChange(o);}}
            style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:600,
              cursor:"pointer",transition:"all .15s",
              background:isActive?ACCENT:"transparent",
              border:"1px solid "+(isActive?ACCENT:BORDER),
              color:isActive?"#fff":MUTED}}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function InfoBtn(props) {
  var term = props.term;
  var onOpen = props.onOpen;
  return (
    <span onClick={function(e){e.stopPropagation();onOpen(term);}}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
        width:15,height:15,borderRadius:"50%",background:ACCENT+"22",
        border:"1px solid "+ACCENT+"44",cursor:"pointer",
        fontSize:9,color:ACCENT,fontWeight:700,flexShrink:0,marginLeft:3}}>
      i
    </span>
  );
}

function GlossaryModal(props) {
  var term = props.term;
  var onClose = props.onClose;
  var entry = GLOSSARY[term];
  if(!entry) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",
      alignItems:"center",justifyContent:"center",
      background:"rgba(0,0,0,.8)",backdropFilter:"blur(10px)"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,borderRadius:20,
          padding:22,width:340,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
        <div style={{fontSize:14,fontWeight:800,color:TEXT,marginBottom:8}}>{entry.title}</div>
        <div style={{fontSize:12,color:TEXT2,lineHeight:1.7}}>{entry.body}</div>
        <button onClick={onClose}
          style={{marginTop:16,width:"100%",padding:"10px",borderRadius:10,
            background:ACCENT,border:"none",color:"#fff",fontSize:13,
            fontWeight:700,cursor:"pointer"}}>
          Got it
        </button>
      </div>
    </div>
  );
}

// ── TICKER ────────────────────────────────────────────────────────────────────
function ShellTicker() {
  var doubled = TICKER_ITEMS.concat(TICKER_ITEMS);
  return (
    <div style={{overflow:"hidden",borderBottom:"1px solid "+BORDER,
      background:"rgba(15,22,35,.95)",padding:"6px 0",position:"relative"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:28,
        background:"linear-gradient(90deg,rgba(8,13,24,1),transparent)",zIndex:2}}/>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:28,
        background:"linear-gradient(270deg,rgba(8,13,24,1),transparent)",zIndex:2}}/>
      <div style={{display:"flex",gap:20,animation:"ticker 28s linear infinite",
        width:"max-content",paddingLeft:16}}>
        {doubled.map(function(item, i) {
          var color = item.hot ? HOT_C : COLD_C;
          var sign = item.chg > 0 ? "+" : "";
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:5,
              fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>
              <span style={{color:color,fontSize:9}}>{item.hot?"^":"v"}</span>
              <span style={{color:TEXT}}>{item.label}</span>
              <span style={{color:TEXT2,fontSize:9}}>{item.cat}</span>
              <span style={{color:color,fontFamily:"'IBM Plex Mono',monospace"}}>
                {sign}{item.chg}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SHELL HEADER ──────────────────────────────────────────────────────────────
function ShellHeader(props) {
  var sport = props.sport;
  var setSport = props.setSport;
  return (
    <div style={{padding:"14px 14px 0",background:BG}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-start",marginBottom:12}}>
        <div style={{fontSize:22,fontWeight:900,letterSpacing:"-.5px"}}>
          <span style={{color:TEXT}}>Sharp</span>
          <span style={{color:ACCENT}}>Slip</span>
        </div>

      </div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12}}>
        {SPORTS.map(function(s) {
          var isActive = sport===s.id;
          return (
            <button key={s.id} onClick={function(){setSport(s.id);}}
              style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
                borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",
                whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT+"22":"transparent",
                border:"2px solid "+(isActive?ACCENT:BORDER),
                color:isActive?ACCENT:TEXT2}}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ── FEATURED EDGE MODAL ───────────────────────────────────────────────────────
function FeaturedEdgeModal(props) {
  var onClose = props.onClose;
  var onFullBreakdown = props.onFullBreakdown;
  var f = FEATURED_EDGE;
  var statRows = [
    {good:true,  label:"Cole ERA / FIP / xFIP", val:"2.91 / 2.44 / 2.88", why:"All sub-3.00 — Cole's dominance is real."},
    {good:true,  label:"Cole CSW% vs BOS",       val:"34.1%",              why:"5+ points above average vs this specific lineup."},
    {good:false, label:"BOS Road K Rate",         val:"28.1% vs RHP",      why:"Highest in AL vs RHP over last 14 days on road."},
    {good:true,  label:"NYY Home Win Streak",     val:"7-1",               why:"Scoring 6.2 R/G at home this month."},
    {good:false, label:"BOS Bullpen Health",      val:"62/100",            why:"Martin and Winckowski both pitched yesterday."},
    {good:true,  label:"H2H 2025",                val:"NYY 6-4",           why:"Outscoring BOS 46-29 in head-to-head meetings."},
    {good:false, label:"Bello xFIP gap",          val:"+0.77",             why:"ERA 3.84 vs xFIP 4.61 — regression incoming."},
  ];
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,
      background:"rgba(0,0,0,.82)",backdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"90vh",overflowY:"auto",
          padding:"22px 18px 36px",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"flex-start",
          justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:10}}>🤖</span>
              <span style={{fontSize:9,fontWeight:800,color:ACCENT,
                letterSpacing:".1em"}}>EDGEVIEW STATISTICAL SUMMARY</span>
            </div>
            <div style={{fontSize:16,fontWeight:900,color:TEXT,lineHeight:1.3}}>
              {f.bet} — Why {f.conf}% Confidence?
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,borderRadius:8,
              width:28,height:28,color:TEXT2,cursor:"pointer",
              fontSize:14,flexShrink:0,marginLeft:10}}>
            x
          </button>
        </div>
        <div style={{padding:"12px 14px",background:CARD3,borderRadius:12,
          marginBottom:16,border:"1px solid "+BORDER}}>
          <div style={{fontSize:12,color:TEXT2,lineHeight:1.7}}>{f.why}</div>
        </div>
        <div style={{fontSize:9,fontWeight:800,color:MUTED,
          letterSpacing:".12em",marginBottom:10}}>STATISTICAL BACKING</div>
        {statRows.map(function(row, i) {
          var color = row.good ? POS_C : NEG_C;
          var bg = row.good ? "rgba(52,211,153,.06)" : "rgba(255,90,90,.06)";
          var border = row.good ? "rgba(52,211,153,.15)" : "rgba(255,90,90,.15)";
          return (
            <div key={i} style={{background:bg,border:"1px solid "+border,
              borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:color,fontWeight:800}}>
                    {row.good ? "v" : "x"}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,color:TEXT}}>
                    {row.label}
                  </span>
                </div>
                <span style={{fontSize:12,fontWeight:800,color:color,
                  fontFamily:"'IBM Plex Mono',monospace",flexShrink:0,marginLeft:8}}>
                  {row.val}
                </span>
              </div>
              <div style={{fontSize:10,color:TEXT2,lineHeight:1.4,paddingLeft:18}}>
                {row.why}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}


// ── EDGE PREVIEW MODAL ────────────────────────────────────────────────────────
var GAME_EDGES = {
  1:[
    {icon:"⚾",bet:"Cole Over 8.5 K",conf:82,grade:"A",
     reason:"BOS 28.1% K rate road vs RHP — AL top-5"},
    {icon:"📈",bet:"NYY Money Line",conf:100,grade:"A",
     reason:"Cole ERA-FIP aligned, BOS bullpen taxed"},
    {icon:"📉",bet:"Under 8.5",conf:94,grade:"B+",
     reason:"Cole projects 5-6 runs, wind blowing IN"},
  ],
  2:[
    {icon:"⚾",bet:"Glasnow Over 9.5 K",conf:76,grade:"B+",
     reason:"SF lineup 26.4% K rate vs RHP this month"},
    {icon:"📉",bet:"Under 7.5",conf:71,grade:"B",
     reason:"Two elite starters, low-scoring matchup"},
  ],
  3:[
    {icon:"🔥",bet:"ATL -1.5 Run Line",conf:74,grade:"B+",
     reason:"Strider home ERA 1.84 last 6 starts"},
    {icon:"📊",bet:"Strider Over 8.5 K",conf:70,grade:"B",
     reason:"HOU 24.1% K rate, Strider CSW% 33.2%"},
  ],
  4:[
    {icon:"📊",bet:"BAL-TOR Over 9.0",conf:68,grade:"B",
     reason:"Means ERA 4.2, Gausman FIP gap 0.6"},
  ],
  5:[
    {icon:"⚾",bet:"McClanahan Over 7.5 K",conf:66,grade:"B",
     reason:"TEX 22.8% K rate on road this week"},
  ],
};

function EdgePreviewModal(props) {
  var game = props.game;
  var onClose = props.onClose;
  var onFullBreakdown = props.onFullBreakdown;
  if(!game) return null;
  var edges = GAME_EDGES[game.id] || [];
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,
      background:"rgba(0,0,0,.82)",backdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"85vh",overflowY:"auto",
          padding:"22px 18px 36px",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontSize:16,fontWeight:900,color:game.away.c}}>
                {game.away.abbr}
              </span>
              <span style={{fontSize:11,color:MUTED}}>@</span>
              <span style={{fontSize:16,fontWeight:900,color:game.home.c}}>
                {game.home.abbr}
              </span>
              {game.status==="Live" && (
                <div style={{display:"flex",alignItems:"center",gap:3,
                  fontSize:9,fontWeight:700,color:NEG_C}}>
                  <div style={{width:5,height:5,borderRadius:"50%",
                    background:NEG_C,animation:"pulse 1.5s infinite"}}/>
                  LIVE
                </div>
              )}
            </div>
            <div style={{fontSize:10,color:MUTED}}>
              O/U {game.total} · {game.ap} vs {game.hp}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,borderRadius:8,
              width:28,height:28,color:TEXT2,cursor:"pointer",fontSize:14}}>
            x
          </button>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:10}}>
            TONIGHT'S EDGES ({edges.length})
          </div>
          {edges.map(function(edge, i) {
            var gradeColor = edge.grade==="A"?POS_C:edge.grade==="B+"?ACCENT:WARN_C;
            return (
              <div key={i} style={{background:CARD3,borderRadius:12,
                padding:"12px 14px",marginBottom:8,
                border:"1px solid "+BORDER}}>
                <div style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14}}>{edge.icon}</span>
                    <span style={{fontSize:13,fontWeight:700,color:TEXT}}>
                      {edge.bet}
                    </span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <GradeChip grade={edge.grade}/>
                    <span style={{fontSize:11,fontWeight:700,color:gradeColor}}>
                      {edge.conf}%
                    </span>
                  </div>
                </div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.5,marginBottom:6}}>
                  {edge.reason}
                </div>
                <ConfBar pct={edge.conf}/>
              </div>
            );
          })}
        </div>
        <button onClick={onFullBreakdown}
          style={{width:"100%",padding:"13px",borderRadius:12,
            background:ACCENT,border:"none",color:"#fff",
            fontSize:13,fontWeight:700,cursor:"pointer"}}>
          See Full Breakdown →
        </button>
      </div>
    </div>
  );
}


// ── FEATURED EDGE CARD ────────────────────────────────────────────────────────
function FeaturedEdgeCard(props) {
  var onSelectGame = props.onSelectGame;
  var onShowModal = props.onShowModal;
  var f = FEATURED_EDGE;
  return (
    <div style={{margin:"0 14px 16px",padding:"14px 16px",
      background:"linear-gradient(135deg,rgba(52,211,153,.08),rgba(8,13,24,0))",
      border:"1px solid rgba(52,211,153,.3)",borderRadius:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:POS_C,
            animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:9,fontWeight:800,color:POS_C,letterSpacing:".1em"}}>
            FEATURED EDGE TONIGHT
          </span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <GradeChip grade={f.grade}/>
          <span style={{fontSize:12,fontWeight:700,color:POS_C}}>{f.conf}%</span>
        </div>
      </div>
      <div style={{fontSize:18,fontWeight:900,color:TEXT,marginBottom:8}}>
        {f.bet}
      </div>
      <div style={{fontSize:11,color:TEXT2,lineHeight:1.6,marginBottom:12}}>
        {f.why}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {f.stats.map(function(s, i) {
          return (
            <div key={i} style={{padding:"4px 10px",borderRadius:10,fontSize:10,
              fontWeight:700,background:s.good?POS_C+"18":NEG_C+"18",
              border:"1px solid "+(s.good?POS_C+"33":NEG_C+"33"),
              color:s.good?POS_C:NEG_C}}>
              {s.label} {s.val}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:10,color:MUTED}}>{f.line}</span>
        <button onClick={function(){onShowModal && onShowModal();}}
          style={{padding:"8px 14px",borderRadius:10,background:ACCENT,
            border:"none",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          Full Breakdown →
        </button>
      </div>
    </div>
  );
}

// ── SLATE GAME CHIP ───────────────────────────────────────────────────────────
function SlateGameChip(props) {
  var g = props.g;
  var onSelectGame = props.onSelectGame;
  var isLive = g.status==="Live";
  var edgeColor = g.edges>=3 ? POS_C : g.edges>=2 ? ACCENT : TEXT2;
  var edgeBg = g.edges>=3 ? "rgba(52,211,153,.1)" : g.edges>=2 ? "rgba(77,159,255,.1)" : "rgba(255,255,255,.04)";
  var showPreviewArr = useState(false);
  var showPreview = showPreviewArr[0];
  var setShowPreview = showPreviewArr[1];
  return (
    <div>
      {showPreview && (
        <EdgePreviewModal game={g}
          onClose={function(){setShowPreview(false);}}
          onFullBreakdown={function(){setShowPreview(false);onSelectGame(g);}}/>
      )}
    <div onClick={function(){setShowPreview(true);}}
      style={{minWidth:180,background:CARD,border:"1px solid "+BORDER,
        borderRadius:14,padding:"12px",cursor:"pointer",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:800,color:g.away.c}}>{g.away.abbr}</span>
          <span style={{fontSize:10,color:MUTED}}>@</span>
          <span style={{fontSize:13,fontWeight:800,color:g.home.c}}>{g.home.abbr}</span>
        </div>
        {isLive ? (
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:9,
            fontWeight:700,color:NEG_C}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:NEG_C,
              animation:"pulse 1.5s infinite"}}/>
            LIVE
          </div>
        ) : (
          <span style={{fontSize:9,color:MUTED}}>{g.time}</span>
        )}
      </div>
      <div style={{fontSize:10,color:TEXT2,marginBottom:6}}>
        O/U {g.total} · {g.ap} vs {g.hp}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{padding:"3px 8px",borderRadius:10,fontSize:9,fontWeight:700,
          background:edgeBg,border:"1px solid "+edgeColor+"44",color:edgeColor}}>
          {g.edges} edge{g.edges!==1?"s":""}
        </div>
      </div>
      <div style={{height:3,borderRadius:2,background:BORDER2,overflow:"hidden"}}>
        <div style={{height:"100%",width:g.winProb+"%",
          background:"linear-gradient(90deg,"+g.away.c+","+g.home.c+")",
          borderRadius:2}}/>
      </div>
    </div>
    </div>
  );
}

// ── GAMES STRIP ───────────────────────────────────────────────────────────────
function GamesStrip(props) {
  var onSelectGame = props.onSelectGame;
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 14px",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:800,color:TEXT}}>Tonight's Games</span>
        <span style={{fontSize:11,color:ACCENT,fontWeight:600}}>See all →</span>
      </div>
      <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 14px",
        scrollbarWidth:"none"}}>
        {SLATE_GAMES.map(function(g) {
          return (
            <SlateGameChip key={g.id} g={g} onSelectGame={onSelectGame}/>
          );
        })}
      </div>
    </div>
  );
}

// ── DRUM WHEEL (Pill buttons) ─────────────────────────────────────────────────
function DrumWheel(props) {
  var lines = props.lines;
  var activeLine = props.activeLine;
  var onChange = props.onChange;
  if(!lines || lines.length<=1) return null;
  return (
    <div style={{display:"flex",gap:4,flexShrink:0,
      background:ACCENT+"10",borderRadius:13,padding:"3px",
      border:"1px solid "+ACCENT+"30"}}>
      {lines.map(function(l) {
        var isActive = l===activeLine;
        return (
          <button key={l} onClick={function(){onChange(l);}}
            style={{padding:"2px 10px",borderRadius:10,fontSize:11,
              fontWeight:isActive?800:500,cursor:"pointer",
              fontFamily:"'IBM Plex Mono',monospace",
              whiteSpace:"nowrap",flexShrink:0,
              background:isActive?ACCENT+"22":"transparent",
              border:"1px solid "+(isActive?ACCENT+"44":"transparent"),
              color:isActive?ACCENT:MUTED,
              opacity:isActive?1:0.6,transition:"all .15s"}}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ── SEE ALL MODAL ─────────────────────────────────────────────────────────────
function SeeAllModal(props) {
  var propKey = props.propKey;
  var activeLine = props.activeLine;
  var isHot = props.isHot;
  var onClose = props.onClose;
  var prop = HOME_PROPS[propKey];
  if(!prop) return null;
  var lineData = prop.lines[activeLine] || {hot:[],cold:[]};
  var items = isHot ? lineData.hot : lineData.cold;
  var color = isHot ? POS_C : NEG_C;
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,
      background:"rgba(0,0,0,.8)",backdropFilter:"blur(10px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"80vh",overflowY:"auto",padding:"20px 16px 36px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <span style={{fontSize:14,fontWeight:800,color:TEXT}}>
              {isHot?"🔥 HOT":"❄️ COLD"} — {prop.label} {activeLine}
            </span>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,borderRadius:8,
              width:28,height:28,color:TEXT2,cursor:"pointer",fontSize:14}}>
            x
          </button>
        </div>
        {items.map(function(item, i) {
          var sign = item.chg > 0 ? "+" : "";
          return (
            <div key={i} style={{display:"flex",alignItems:"center",
              justifyContent:"space-between",padding:"10px 0",
              borderBottom:"1px solid "+BORDER}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,fontWeight:700,color:MUTED,
                  fontFamily:"'IBM Plex Mono',monospace",minWidth:18}}>
                  {i+1}
                </span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{item.name}</div>
                  <div style={{fontSize:10,color:MUTED}}>{item.team}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:800,color:color,
                  fontFamily:"'IBM Plex Mono',monospace"}}>
                  {sign}{item.chg}%
                </div>
                <div style={{fontSize:9,color:MUTED}}>
                  {isHot?"🔥":"❄️"} {Math.abs(item.streak)}G
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HOME TILE PAIR ────────────────────────────────────────────────────────────
function HomeTilePair(props) {
  var propKey = props.propKey;
  var timeWindow = props.timeWindow;
  var prop = HOME_PROPS[propKey];
  if(!prop) return null;
  var lineKeys = Object.keys(prop.lines);
  var firstLine = lineKeys[0] || "";
  var stateArr = useState(firstLine);
  var activeLine = stateArr[0];
  var setActiveLine = stateArr[1];
  var seeAllHotArr = useState(false);
  var seeAllHot = seeAllHotArr[0];
  var setSeeAllHot = seeAllHotArr[1];
  var seeAllColdArr = useState(false);
  var seeAllCold = seeAllColdArr[0];
  var setSeeAllCold = seeAllColdArr[1];
  var lineData = prop.lines[activeLine] || {hot:[],cold:[]};
  return (
    <div style={{marginBottom:18}}>
      {seeAllHot && (
        <SeeAllModal propKey={propKey} activeLine={activeLine}
          isHot={true} onClose={function(){setSeeAllHot(false);}}/>
      )}
      {seeAllCold && (
        <SeeAllModal propKey={propKey} activeLine={activeLine}
          isHot={false} onClose={function(){setSeeAllCold(false);}}/>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:8,padding:"0 2px"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          <span style={{fontSize:13}}>{prop.icon}</span>
          <span style={{fontSize:12,fontWeight:800,color:TEXT}}>{prop.label}</span>
        </div>
        <DrumWheel lines={lineKeys} activeLine={activeLine} onChange={setActiveLine}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[true,false].map(function(isHot) {
          var color = isHot ? POS_C : NEG_C;
          var bg = isHot ? "rgba(52,211,153,.07)" : "rgba(255,90,90,.07)";
          var items = isHot ? lineData.hot : lineData.cold;
          var label = isHot ? "🔥 HOT" : "❄️ COLD";
          return (
            <div key={String(isHot)}
              style={{background:bg,borderRadius:12,padding:"10px",
                border:"1px solid "+(color+"22")}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:800,color:color,letterSpacing:".08em"}}>
                  {label}
                </span>
                <span style={{fontSize:8,color:MUTED}}>{timeWindow}</span>
              </div>
              {items.slice(0,3).map(function(item, i) {
                var sign = item.chg > 0 ? "+" : "";
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,color:MUTED,
                        fontFamily:"'IBM Plex Mono',monospace",minWidth:10}}>
                        {i+1}
                      </span>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:TEXT}}>{item.name}</div>
                        <div style={{fontSize:9,color:MUTED}}>{item.team}</div>
                      </div>
                    </div>
                    <span style={{fontSize:11,fontWeight:800,color:color,
                      fontFamily:"'IBM Plex Mono',monospace"}}>
                      {sign}{item.chg}%
                    </span>
                  </div>
                );
              })}
              <div onClick={function(){isHot?setSeeAllHot(true):setSeeAllCold(true);}}
                style={{textAlign:"center",paddingTop:6,fontSize:10,
                  color:ACCENT,fontWeight:600,cursor:"pointer"}}>
                See all →
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── NFL DATA ──────────────────────────────────────────────────────────────────
var NFL_TICKER = [
  {label:"Mahomes",  val:"Sharp money ON KC -6.5",   good:true},
  {label:"McCaffrey",val:"Listed questionable",       good:false},
  {label:"Bills O/U",val:"47.5 → 49.5 line move",   good:true},
  {label:"Lamar",   val:"Rushing yds O/U 58.5",      good:true},
  {label:"Eagles",  val:"ATS 7-2 last 9",            good:true},
  {label:"Tyreek",  val:"Rec yds O/U 74.5",          good:true},
  {label:"Cowboys", val:"Public 68% — fade alert",   good:false},
  {label:"Burrow",  val:"Pass yds O/U 284.5",        good:true},
  {label:"49ers",   val:"Home field edge +4.2 pts",  good:true},
  {label:"Pitts",   val:"Listed limited in practice",good:false},
];

var NFL_SLATE = [
  {id:"nfl1", away:{abbr:"BUF",name:"Buffalo Bills"},
   home:{abbr:"KC",name:"Kansas City Chiefs"},
   time:"Sun 4:25 PM", network:"CBS",
   spread:"KC -3",total:"47.5",awayML:"+135",homeML:"-155",
   winProb:62, edge:"KC -3 Cover", edgeConf:88,
   awayScore:null,homeScore:null,quarter:null},
  {id:"nfl2", away:{abbr:"PHI",name:"Philadelphia Eagles"},
   home:{abbr:"DAL",name:"Dallas Cowboys"},
   time:"Sun 8:20 PM", network:"NBC",
   spread:"PHI -4.5",total:"44.5",awayML:"-195",homeML:"+165",
   winProb:66, edge:"Under 44.5", edgeConf:82,
   awayScore:null,homeScore:null,quarter:null},
  {id:"nfl3", away:{abbr:"SF",name:"San Francisco 49ers"},
   home:{abbr:"LAR",name:"Los Angeles Rams"},
   time:"Mon 8:15 PM", network:"ESPN",
   spread:"SF -6",total:"46.0",awayML:"-245",homeML:"+205",
   winProb:70, edge:"SF -6 Cover", edgeConf:79,
   awayScore:null,homeScore:null,quarter:null},
  {id:"nfl4", away:{abbr:"BAL",name:"Baltimore Ravens"},
   home:{abbr:"CIN",name:"Cincinnati Bengals"},
   time:"Thu 8:15 PM", network:"Prime",
   spread:"BAL -2.5",total:"49.5",awayML:"-135",homeML:"+115",
   winProb:58, edge:"Over 49.5", edgeConf:76,
   awayScore:null,homeScore:null,quarter:null},
  {id:"nfl5", away:{abbr:"DET",name:"Detroit Lions"},
   home:{abbr:"GB",name:"Green Bay Packers"},
   time:"Sun 1:00 PM", network:"FOX",
   spread:"DET -1.5",total:"45.0",awayML:"-120",homeML:"+101",
   winProb:54, edge:"DET ML", edgeConf:72,
   awayScore:null,homeScore:null,quarter:null},
];

var NFL_FEATURED = {
  game:"BUF @ KC", bet:"KC -3 Cover",
  conf:88, grade:"A",
  analysis:"Sharp money has moved KC from -2.5 to -3 over the last 48 hours. Mahomes at home in January is the most reliable ATS spot in football — 14-4 in his last 18 home starts vs teams with winning records. BUF secondary is depleted and KC receiving corps is healthy.",
  bullets:[
    "KC 14-4 ATS last 18 home starts vs winning teams",
    "Sharp line move: KC -2.5 → -3 in last 48 hours",
    "BUF CB1 Tre'Davious White listed questionable",
    "Mahomes home playoff ERA: 102.4 passer rating",
  ],
  line:"DK: KC -3 -110",
  altPlay:"KC First Half -1.5 at -118",
};

var NFL_MOVERS = {
  QB:[
    {name:"P. Mahomes", team:"KC",  hot:true,  cold:false, stat:"Pass Yds O/U",val:"312.5",trend:"+18.4 last 3G"},
    {name:"J. Burrow",  team:"CIN", hot:true,  cold:false, stat:"Pass Yds O/U",val:"284.5",trend:"+22.1 last 3G"},
    {name:"J. Hurts",   team:"PHI", hot:true,  cold:false, stat:"Rush Yds O/U", val:"44.5", trend:"+11.2 last 3G"},
    {name:"L. Jackson", team:"BAL", hot:true,  cold:false, stat:"Rush Yds O/U", val:"58.5", trend:"+14.8 last 3G"},
    {name:"D. Prescott", team:"DAL",hot:false, cold:true,  stat:"Pass Yds O/U",val:"241.5",trend:"-24.1 last 3G"},
    {name:"J. Goff",    team:"DET", hot:false, cold:false, stat:"Pass Yds O/U",val:"258.5",trend:"+4.2 last 3G"},
  ],
  RB:[
    {name:"C. McCaffrey",team:"SF", hot:true,  cold:false, stat:"Rush Yds O/U",val:"84.5", trend:"+18.4 last 3G"},
    {name:"D. Henry",   team:"TEN", hot:true,  cold:false, stat:"Rush Yds O/U",val:"94.5", trend:"+22.1 last 3G"},
    {name:"J. Gibbs",   team:"DET", hot:true,  cold:false, stat:"Rush Yds O/U",val:"68.5", trend:"+14.2 last 3G"},
    {name:"T. Pollard", team:"TEN", hot:false, cold:true,  stat:"Rush Yds O/U",val:"48.5", trend:"-18.4 last 3G"},
    {name:"A. Jones",   team:"MIN", hot:false, cold:true,  stat:"Rush Yds O/U",val:"44.5", trend:"-12.1 last 3G"},
    {name:"R. Stevenson",team:"NE", hot:false, cold:true,  stat:"Rush Yds O/U",val:"38.5", trend:"-8.4 last 3G"},
  ],
  WR:[
    {name:"T. Hill",    team:"MIA", hot:true,  cold:false, stat:"Rec Yds O/U", val:"88.5", trend:"+24.1 last 3G"},
    {name:"J. Chase",   team:"CIN", hot:true,  cold:false, stat:"Rec Yds O/U", val:"84.5", trend:"+18.4 last 3G"},
    {name:"S. Diggs",   team:"BUF", hot:true,  cold:false, stat:"Rec Yds O/U", val:"74.5", trend:"+12.1 last 3G"},
    {name:"D. Adams",   team:"LV",  hot:false, cold:true,  stat:"Rec Yds O/U", val:"54.5", trend:"-18.4 last 3G"},
    {name:"A. Cooper",  team:"CLE", hot:false, cold:true,  stat:"Rec Yds O/U", val:"44.5", trend:"-14.1 last 3G"},
    {name:"C. Lamb",    team:"DAL", hot:false, cold:false, stat:"Rec Yds O/U", val:"78.5", trend:"+2.4 last 3G"},
  ],
  Teams:[
    {name:"Kansas City Chiefs",   team:"KC",  hot:true,  cold:false, stat:"ATS",val:"7-2",  trend:"Last 9 home"},
    {name:"Philadelphia Eagles",  team:"PHI", hot:true,  cold:false, stat:"ATS",val:"7-2",  trend:"Last 9 overall"},
    {name:"San Francisco 49ers",  team:"SF",  hot:true,  cold:false, stat:"ATS",val:"6-3",  trend:"Last 9 overall"},
    {name:"Dallas Cowboys",       team:"DAL", hot:false, cold:true,  stat:"ATS",val:"2-7",  trend:"Last 9 overall"},
    {name:"New England Patriots", team:"NE",  hot:false, cold:true,  stat:"ATS",val:"2-7",  trend:"Last 9 overall"},
    {name:"Las Vegas Raiders",    team:"LV",  hot:false, cold:true,  stat:"ATS",val:"3-6",  trend:"Last 9 overall"},
  ],
};

var NFL_TEAM_C = {
  KC:"#E31837",BUF:"#00338D",PHI:"#004C54",DAL:"#003594",
  SF:"#AA0000", LAR:"#003594",BAL:"#241773",CIN:"#FB4F14",
  DET:"#0076B6",GB:"#203731", MIA:"#008E97",MIN:"#4F2683",
  NE:"#002244", LV:"#A5ACAF", TEN:"#4B92DB",NYG:"#0B2265",
  NYJ:"#125740",WAS:"#5A1414",CHI:"#0B162A",ATL:"#A71930",
  CAR:"#0085CA",NO:"#D3BC8D", TB:"#D50A0A", ARI:"#97233F",
  SEA:"#002244",LAC:"#0080C6",DEN:"#FB4F14",HOU:"#03202F",
  IND:"#002C5F",JAX:"#006778",PIT:"#FFB612",CLE:"#FF3C00",
};

var NFL_GAME_EDGES = {
  nfl1:[
    {icon:"📈",bet:"KC -3 Cover",       conf:88,grade:"A", type:"spread",
     line:"DK: KC -3 -110",   why:"Sharp money, Mahomes home dominance, depleted BUF secondary"},
    {icon:"📉",bet:"Under 47.5",         conf:81,grade:"A-",type:"total",
     line:"DK: Under -108",   why:"Both defenses elite, cold weather expected, slow-paced matchup"},
    {icon:"🎯",bet:"Mahomes Over 284.5 Pass Yds",conf:79,grade:"B+",type:"prop",
     line:"DK: Over 284.5 -115",why:"Mahomes averages 312 yds at home, BUF secondary missing starters"},
  ],
  nfl2:[
    {icon:"📈",bet:"PHI -4.5 Cover",     conf:82,grade:"A-",type:"spread",
     line:"DK: PHI -4.5 -110",why:"Eagles 7-2 ATS, Dallas struggling on defense last 4 weeks"},
    {icon:"📉",bet:"Under 44.5",         conf:76,grade:"B+",type:"total",
     line:"DK: Under -112",   why:"Both teams ranked top 8 in points allowed, prime time slow starts"},
    {icon:"🎯",bet:"Hurts Over 44.5 Rush Yds",conf:74,grade:"B+",type:"prop",
     line:"DK: Over 44.5 -118",why:"Hurts averages 52 rush yds vs DAL, scrambles when pocket collapses"},
  ],
  nfl3:[
    {icon:"📈",bet:"SF -6 Cover",        conf:79,grade:"B+",type:"spread",
     line:"DK: SF -6 -110",   why:"49ers 6-3 ATS, Rams missing two starting OL, McCaffrey healthy"},
    {icon:"🎯",bet:"McCaffrey Over 74.5 Rush Yds",conf:77,grade:"B+",type:"prop",
     line:"DK: Over 74.5 -118",why:"CMC averages 88 rush yds vs LAR, Rams run D ranked 24th"},
    {icon:"📋",bet:"Over 46.0",          conf:72,grade:"B", type:"total",
     line:"DK: Over -108",    why:"SF offense averaging 31 pts at home, LAR pass D vulnerable"},
  ],
  nfl4:[
    {icon:"📋",bet:"Over 49.5",          conf:76,grade:"B+",type:"total",
     line:"DK: Over -110",    why:"Both teams top-10 offenses, indoor feel — dome effect in CIN"},
    {icon:"🎯",bet:"Lamar Over 58.5 Rush Yds",conf:74,grade:"B+",type:"prop",
     line:"DK: Over 58.5 -125",why:"Lamar averages 68 rush yds vs CIN, zone D invites QB scrambles"},
    {icon:"📈",bet:"BAL -2.5 Cover",     conf:71,grade:"B", type:"spread",
     line:"DK: BAL -2.5 -115",why:"Ravens 5-4 ATS but defense elite vs Burrow under pressure"},
  ],
  nfl5:[
    {icon:"📈",bet:"DET ML",             conf:72,grade:"B", type:"ml",
     line:"DK: DET -120",     why:"Lions -1.5 road favorites but ML value, Goff hot streak 4G"},
    {icon:"📉",bet:"Under 45.0",         conf:70,grade:"B", type:"total",
     line:"DK: Under -108",   why:"GB defense improved last 3 weeks, cold Lambeau weather"},
    {icon:"🎯",bet:"Gibbs Over 68.5 Rush Yds",conf:68,grade:"B", type:"prop",
     line:"DK: Over 68.5 -118",why:"Gibbs averaging 74 rush yds last 4G, GB run D ranked 18th"},
  ],
};


// ── NFL HOME COMPONENTS ───────────────────────────────────────────────────────


// ── NFL GAME DATA ─────────────────────────────────────────────────────────────
var NFL_GAME = {
  away:{abbr:"BUF",name:"Buffalo Bills",   color:"#00338D",qb:"Josh Allen",   qbRating:94.8,  qbHot:false},
  home:{abbr:"KC", name:"Kansas City Chiefs",color:"#E31837",qb:"P. Mahomes",  qbRating:108.4, qbHot:true},
  spread:"KC -3", total:"47.5",
  awayML:"+135",  homeML:"-155",
  winProb:62,
  venue:"Arrowhead Stadium",
  status:"Sun 4:25 PM",
  context:[
    {label:"Win Prob",  val:"KC 62%",       color:"#E31837"},
    {label:"H2H 2024",  val:"KC 2-1",       color:"#4d9fff"},
    {label:"O/U Trend", val:"Under 58%",    color:"#4d9fff"},
    {label:"Sharp",     val:"KC -3 heavy",  color:"#34d399"},
  ],
};

var NFL_FULL_EDGES = [
  {id:1,icon:"📈",bet:"KC -3 Cover",        team:"KC", type:"spread",
   grade:"A",  conf:88, supporting:5, line:"DK: KC -3 -110",
   altPlay:"KC First Half -1.5 at -118",
   analysis:"Sharp money has moved KC from -2.5 to -3 in 48 hours. Mahomes is 14-4 ATS in home starts vs winning teams. BUF's CB1 is questionable and KC's receiving corps is fully healthy entering this matchup.",
   bullets:["KC 14-4 ATS last 18 home starts vs winning teams","Sharp line move KC -2.5 → -3 in last 48 hours","BUF CB1 Tre'Davious White listed questionable","Mahomes home passer rating 108.4 this season"],
   factors:[
     {label:"Sharp line move",    score:1,weight:9,why:"KC -2.5 to -3 in 48hrs signals heavy sharp action on Chiefs. Line moves against public indicate professional bettor confidence."},
     {label:"Mahomes home ATS",   score:1,weight:8,why:"14-4 ATS in home starts vs winning teams — one of the most reliable home ATS spots in the NFL. Mahomes consistently covers at Arrowhead."},
     {label:"BUF CB1 questionable",score:-1,weight:7,why:"Tre'Davious White listed questionable limits BUF's ability to shadow Kelce and Hill. KC passing attack benefits directly from this injury."},
     {label:"Public on BUF",      score:1,weight:6,why:"68% of public money on BUF creates sharp reverse line movement toward KC. Fading the public in this spot historically profitable."},
     {label:"KC home record",     score:1,weight:5,why:"KC 9-2 at home this season covering at a 57% ATS rate — strong home field advantage at Arrowhead."},
   ]},
  {id:2,icon:"📉",bet:"Under 47.5",          team:"",  type:"total",
   grade:"A-", conf:81, supporting:4, line:"DK: Under 47.5 -108",
   altPlay:"First Half Under 24.5 at -115",
   analysis:"Both defenses are elite. KC allows 19.4 PPG and BUF allows 18.2 PPG. Cold weather forecast at Arrowhead reduces scoring. Under hit in 5 of last 7 meetings between these teams.",
   bullets:["KC defense 4th in points allowed (19.4 PPG)","BUF defense 3rd in points allowed (18.2 PPG)","Cold weather forecast — 28°F at kickoff","Under 5-2 in last 7 KC vs BUF matchups"],
   factors:[
     {label:"Elite defenses",     score:1,weight:8,why:"KC and BUF are top-5 defenses in points allowed. When two elite defenses meet, totals consistently go under — historically 61% in such matchups."},
     {label:"Cold weather",       score:1,weight:7,why:"28°F at kickoff reduces passing efficiency by approximately 8% based on historical data. Cold weather games go under at a 58% rate."},
     {label:"H2H under trend",    score:1,weight:6,why:"Under 5-2 in last 7 meetings between these teams. Both coaching staffs prioritize ball control and field position in high-stakes matchups."},
     {label:"Mahomes cold weather",score:-1,weight:4,why:"Mahomes actually excels in cold weather (112.4 rating below 32°F) which partially offsets the weather suppression factor."},
   ]},
  {id:3,icon:"🎯",bet:"Mahomes Over 284.5 Pass Yds",team:"KC",type:"prop",
   grade:"A-", conf:79, supporting:4, line:"DK: Over 284.5 -115",
   altPlay:"Mahomes Over 2.5 TD passes at +120",
   analysis:"Mahomes averages 312 pass yards at home this season. BUF's secondary is missing a starter. KC's offensive scheme forces the ball to Mahomes in high-leverage spots consistently.",
   bullets:["Mahomes 312 avg pass yds at home this season","BUF allowing 248 pass yds/G over last 4 weeks","Kelce fully healthy — primary target in red zone","KC trailing by halftime triggers Mahomes big pass games"],
   factors:[
     {label:"Mahomes home avg",   score:1,weight:8,why:"312 average passing yards at home this season — well above the 284.5 line. Arrowhead crowd noise forces opposing defense into penalties, opening passing lanes."},
     {label:"BUF secondary injury",score:1,weight:7,why:"Missing a starting CB forces BUF into zone coverage which Mahomes dissects methodically. Zone D allows 18% more passing yards on average."},
     {label:"Kelce healthy",      score:1,weight:6,why:"Kelce is Mahomes' primary target in high-leverage situations. With Kelce at full health, Mahomes has a reliable safety valve that consistently creates chunk yardage."},
     {label:"Cold weather",       score:-1,weight:4,why:"28°F can affect deep ball accuracy and trajectory slightly. Mahomes may check down more frequently, capping per-play yardage upside."},
   ]},
  {id:4,icon:"🏃",bet:"Josh Allen Over 44.5 Rush Yds",team:"BUF",type:"prop",
   grade:"B+", conf:74, supporting:3, line:"DK: Over 44.5 -118",
   altPlay:"Josh Allen Anytime TD scorer at +140",
   analysis:"Allen averages 52 rush yards vs KC in his career. KC's defense prioritizes stopping the pass, leaving scramble lanes open. Allen's rushing is his most consistent prop against this defense.",
   bullets:["Allen career avg 52 rush yds vs KC","KC allows 14th most QB rush yards in NFL","Allen scrambles when KC generates pressure","4 of last 5 games vs KC: Allen hit 44.5+"],
   factors:[
     {label:"Allen vs KC history", score:1,weight:7,why:"Allen averages 52 rush yards in career matchups against KC — 7.5 yards above tonight's line. Pattern is consistent regardless of game script."},
     {label:"KC QB rush tendency", score:1,weight:6,why:"KC defense ranked 14th in QB rush yards allowed. Spagnuolo's scheme prioritizes pass coverage, leaving designed runs and scramble lanes available."},
     {label:"Pressure = scrambles",score:1,weight:5,why:"When KC generates pass rush pressure, Allen consistently uses his legs rather than forcing throws. KC blitzes 28% of snaps — highest rate in AFC."},
     {label:"Cold weather legs",   score:-1,weight:3,why:"Cold turf can reduce footing on scramble attempts. Minor risk factor for rushing yards in 28°F conditions."},
   ]},
  {id:5,icon:"🏈",bet:"Travis Kelce Over 54.5 Rec Yds",team:"KC",type:"prop",
   grade:"B+", conf:76, supporting:3, line:"DK: Over 54.5 -122",
   altPlay:"Kelce Anytime TD at +175",
   analysis:"Kelce averages 74 rec yards at home this season. BUF struggles against elite TEs — ranked 22nd in TE receiving yards allowed. Mahomes targets Kelce on 24.8% of routes.",
   bullets:["Kelce 74 avg rec yds at home this season","BUF ranked 22nd vs TE receiving yards","Mahomes to Kelce: 24.8% target share","Kelce 5+ rec in 11 of last 14 home games"],
   factors:[
     {label:"Kelce home avg",     score:1,weight:8,why:"74 average receiving yards at home this season — nearly 20 yards above the 54.5 line. Arrowhead atmosphere creates timing advantages in the Kelce-Mahomes connection."},
     {label:"BUF TE coverage",    score:1,weight:7,why:"BUF ranked 22nd in TE receiving yards allowed. They lack a linebacker fast enough to cover Kelce in space, forcing safety help that opens other receivers."},
     {label:"Target share",       score:1,weight:6,why:"24.8% target share means on a 35-attempt Mahomes game, Kelce sees roughly 8-9 targets. At his catch rate and YPC, that projects well over 54.5."},
     {label:"Cold weather",       score:-1,weight:3,why:"Cold weather may limit the deep seam routes that produce Kelce's biggest games. More check-down work could hold yardage closer to the line."},
   ]},
];

var NFL_PARLAY_COMBOS = {
  2:[
    {legs:["KC -3 Cover","Under 47.5"],         prob:72,odds:"-145",label:"Best Combo"},
    {legs:["Mahomes Over 284.5 Yds","KC -3"],    prob:68,odds:"-125",label:"QB Stack"},
    {legs:["Kelce Over 54.5 Yds","Under 47.5"],  prob:66,odds:"-118",label:"Value Play"},
  ],
  3:[
    {legs:["KC -3","Under 47.5","Kelce Over 54.5"],  prob:58,odds:"+165",label:"Best Combo"},
    {legs:["KC -3","Mahomes Over 284.5","Under 47.5"],prob:54,odds:"+185",label:"KC Stack"},
    {legs:["KC -3","Allen Rush Over 44.5","Under 47.5"],prob:51,odds:"+210",label:"Rush Stack"},
  ],
  4:[
    {legs:["KC -3","Under 47.5","Kelce Over 54.5","Mahomes Over 284.5"],prob:42,odds:"+380",label:"Best Combo"},
  ],
  5:[
    {legs:["KC -3","Under 47.5","Kelce Over 54.5","Mahomes Over 284.5","Allen Rush Over 44.5"],prob:31,odds:"+940",label:"Best Combo"},
  ],
};

var NFL_BET_TYPE_OPTS = [
  {id:"spread",label:"Spread",     icon:"📈"},
  {id:"ml",    label:"Money Line", icon:"💰"},
  {id:"ou",    label:"Over/Under", icon:"📋"},
  {id:"1h",    label:"1st Half",   icon:"1️⃣"},
  {id:"td",    label:"TD Props",   icon:"🏈"},
  {id:"pass",  label:"Pass Yds",   icon:"🎯"},
  {id:"rush",  label:"Rush Yds",   icon:"🏃"},
  {id:"rec",   label:"Rec Yds",    icon:"📐"},
  {id:"anytime",label:"Anytime TD",icon:"⚡"},
  {id:"kicker",label:"Kicker",     icon:"🦵"},
];


function NFLPreviewModal(props) {
  var game = props.game;
  var onClose = props.onClose;
  var onFullBreakdown = props.onFullBreakdown;
  if(!game) return null;
  var edges = NFL_GAME_EDGES[game.id] || [];
  var awayC = NFL_TEAM_C[game.away.abbr] || ACCENT;
  var homeC = NFL_TEAM_C[game.home.abbr] || ACCENT;
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,
      background:"rgba(0,0,0,.82)",backdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"85vh",overflowY:"auto",
          padding:"22px 18px 36px",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"center",
          justifyContent:"space-between",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16,fontWeight:900,color:awayC}}>
                {game.away.abbr}
              </span>
              <span style={{fontSize:12,color:MUTED}}>@</span>
              <span style={{fontSize:16,fontWeight:900,color:homeC}}>
                {game.home.abbr}
              </span>
            </div>
            <div style={{background:CARD3,borderRadius:8,padding:"3px 8px"}}>
              <span style={{fontSize:10,color:TEXT2}}>{game.spread}</span>
              <span style={{fontSize:10,color:MUTED}}> · O/U {game.total}</span>
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,
              borderRadius:8,width:28,height:28,color:TEXT2,
              cursor:"pointer",fontSize:14}}>x</button>
        </div>
        <div style={{fontSize:9,color:MUTED,marginBottom:14}}>
          {game.time} · {game.network}
        </div>
        <div style={{fontSize:9,fontWeight:800,color:MUTED,
          letterSpacing:".1em",marginBottom:10}}>TOP EDGES</div>
        {edges.map(function(edge, i) {
          var catColor = edge.type==="spread"?POS_C:edge.type==="total"?ACCENT:WARN_C;
          var catLabel = edge.type==="spread"?"Spread":edge.type==="total"?"Total":
                         edge.type==="ml"?"Money Line":"Player Prop";
          return (
            <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
              borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>{edge.icon}</span>
                  <span style={{fontSize:13,fontWeight:700,color:TEXT}}>
                    {edge.bet}
                  </span>
                </div>
                <span style={{fontSize:14,fontWeight:900,
                  color:edge.grade==="A"||edge.grade==="A-"?POS_C:ACCENT}}>
                  {edge.grade}
                </span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                  borderRadius:10,background:catColor+"22",
                  border:"1px solid "+catColor+"44",color:catColor}}>
                  {catLabel}
                </span>
                <span style={{fontSize:10,color:POS_C,fontWeight:600}}>
                  {edge.conf}%
                </span>
              </div>
              <div style={{height:3,background:BORDER2,borderRadius:2,
                overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",width:edge.conf+"%",
                  background:edge.conf>=85?POS_C:edge.conf>=75?ACCENT:WARN_C,
                  borderRadius:2}}/>
              </div>
              <div style={{fontSize:10,color:MUTED,marginBottom:4,
                fontFamily:"'IBM Plex Mono',monospace"}}>{edge.line}</div>
              <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>{edge.why}</div>
            </div>
          );
        })}
        <button onClick={onFullBreakdown}
          style={{width:"100%",marginTop:8,padding:"12px",borderRadius:14,
            background:ACCENT,border:"none",color:"#fff",
            fontSize:13,fontWeight:700,cursor:"pointer"}}>
          See Full Breakdown
        </button>
      </div>
    </div>
  );
}



function NFLFeaturedEdgeModal(props) {
  var onClose = props.onClose;
  var onFullBreakdown = props.onFullBreakdown;
  var f = NFL_FEATURED;
  var edge = NFL_FULL_EDGES[0];
  var sectionArr = useState("analysis");
  var section = sectionArr[0]; var setSection = sectionArr[1];
  var statRows = [
    {good:true,  label:"Sharp line move KC -2.5 → -3", val:"48 hrs",      why:"Professional money moving the line against 68% public on BUF signals significant sharp action on KC."},
    {good:true,  label:"Mahomes ATS at home vs winners", val:"14-4 (78%)", why:"One of the most reliable home ATS spots in football over the last 3 seasons."},
    {good:false, label:"BUF CB1 questionable",           val:"Limited",    why:"Losing Tre'Davious White limits BUF's ability to shadow Kelce — directly benefits KC passing attack."},
    {good:true,  label:"Public on BUF",                  val:"68%",        why:"Heavy public action creates contrarian value on KC. Fading 65%+ public has been profitable at 54% this season."},
    {good:true,  label:"KC home record",                 val:"9-2",        why:"9-2 at Arrowhead this season with a +116 point differential. Dominant home unit."},
  ];
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,
      background:"rgba(0,0,0,.85)",backdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"90vh",overflowY:"auto",
          padding:"22px 18px 36px",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"flex-start",
          justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:10}}>🏆</span>
              <span style={{fontSize:9,fontWeight:800,color:WARN_C,letterSpacing:".1em"}}>
                TOP EDGE THIS WEEK
              </span>
            </div>
            <div style={{fontSize:15,fontWeight:900,color:TEXT,lineHeight:1.3}}>
              {f.bet}
            </div>
            <div style={{fontSize:11,color:MUTED,marginTop:4}}>{f.game}</div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,borderRadius:8,
              width:28,height:28,color:TEXT2,cursor:"pointer",fontSize:14,
              flexShrink:0,marginLeft:10}}>x</button>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid "+BORDER,marginBottom:14}}>
          {[["analysis","📋 Analysis"],["signals","📡 Signals"],["lines","📖 Lines"]].map(function(item) {
            var id=item[0]; var label=item[1];
            var isActive = section===id;
            return (
              <button key={id} onClick={function(){setSection(id);}}
                style={{flex:1,padding:"8px 4px",fontSize:10,fontWeight:600,
                  cursor:"pointer",border:"none",
                  background:"transparent",color:isActive?TEXT:MUTED,
                  borderBottom:isActive?"2px solid "+POS_C:"2px solid transparent"}}>
                {label}
              </button>
            );
          })}
        </div>

        {section==="analysis" && (
          <div>
            <div style={{padding:"12px 14px",background:CARD3,borderRadius:12,
              marginBottom:14,border:"1px solid "+BORDER}}>
              <div style={{fontSize:12,color:TEXT2,lineHeight:1.7}}>{f.analysis}</div>
            </div>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".12em",marginBottom:10}}>KEY FACTORS</div>
            {statRows.map(function(row, i) {
              var color = row.good ? POS_C : NEG_C;
              var bg = row.good ? "rgba(52,211,153,.06)" : "rgba(255,90,90,.06)";
              var border = row.good ? "rgba(52,211,153,.15)" : "rgba(255,90,90,.15)";
              return (
                <div key={i} style={{background:bg,border:"1px solid "+border,
                  borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,color:color,fontWeight:800}}>
                        {row.good?"v":"x"}
                      </span>
                      <span style={{fontSize:12,fontWeight:700,color:TEXT}}>
                        {row.label}
                      </span>
                    </div>
                    <span style={{fontSize:11,fontWeight:800,color:color,
                      fontFamily:"'IBM Plex Mono',monospace",flexShrink:0,marginLeft:8}}>
                      {row.val}
                    </span>
                  </div>
                  <div style={{fontSize:10,color:TEXT2,lineHeight:1.4,paddingLeft:18}}>
                    {row.why}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {section==="signals" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",
              gap:8,marginBottom:12}}>
              {[[POS_C,"Supporting",edge.supporting],[NEG_C,"Risk",1]].map(function(item) {
                return (
                  <div key={item[1]} style={{textAlign:"center",padding:"12px 8px",
                    background:CARD3,borderRadius:12}}>
                    <div style={{fontSize:22,fontWeight:800,color:item[0]}}>{item[2]}</div>
                    <div style={{fontSize:10,color:MUTED}}>{item[1]}</div>
                  </div>
                );
              })}
            </div>
            {(edge.factors||[]).map(function(f2, i) {
              var fc = f2.score>0?POS_C:f2.score<0?NEG_C:MUTED;
              return (
                <div key={i} style={{background:CARD3,borderRadius:10,
                  padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,color:fc,fontWeight:800}}>
                        {f2.score>0?"v":"x"}
                      </span>
                      <span style={{fontSize:11,fontWeight:600,color:TEXT}}>{f2.label}</span>
                    </div>
                    <span style={{fontSize:9,color:MUTED}}>Wt {f2.weight}/10</span>
                  </div>
                  <div style={{height:2,background:BORDER2,borderRadius:1,overflow:"hidden"}}>
                    <div style={{height:"100%",width:(f2.weight*10)+"%",
                      background:fc,borderRadius:1}}/>
                  </div>
                  <div style={{fontSize:10,color:TEXT2,marginTop:6,lineHeight:1.5}}>
                    {f2.why}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {section==="lines" && (
          <div>
            <div style={{background:CARD3,borderRadius:12,padding:"14px",marginBottom:10}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:6}}>Sample Line</div>
              <div style={{fontSize:16,fontWeight:900,color:ACCENT,
                fontFamily:"'IBM Plex Mono',monospace"}}>{f.line}</div>
            </div>
            <div style={{background:CARD3,borderRadius:12,padding:"14px",marginBottom:10}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:6}}>Alt Play</div>
              <div style={{fontSize:13,fontWeight:700,color:TEXT2}}>{f.altPlay}</div>
            </div>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:8}}>SUPPORTING BULLETS</div>
            {f.bullets.map(function(b, i) {
              return (
                <div key={i} style={{display:"flex",alignItems:"flex-start",
                  gap:6,marginBottom:6}}>
                  <span style={{color:POS_C,fontSize:10,flexShrink:0}}>•</span>
                  <span style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>{b}</span>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={onFullBreakdown}
          style={{width:"100%",marginTop:14,padding:"12px",borderRadius:14,
            background:ACCENT,border:"none",color:"#fff",
            fontSize:13,fontWeight:700,cursor:"pointer"}}>
          See Full Game Breakdown
        </button>
      </div>
    </div>
  );
}


function NFLTicker() {
  return (
    <div style={{overflowX:"auto",whiteSpace:"nowrap",padding:"8px 0",
      borderBottom:"1px solid "+BORDER,marginBottom:0}}>
      <div style={{display:"inline-flex",gap:16,padding:"0 14px"}}>
        {NFL_TICKER.map(function(item, i) {
          return (
            <div key={i} style={{display:"inline-flex",alignItems:"center",gap:4,
              fontSize:10,flexShrink:0}}>
              <span style={{color:MUTED,fontWeight:600}}>{item.label}</span>
              <span style={{color:item.good?POS_C:NEG_C,fontWeight:700}}>
                {item.val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NFLGameChip(props) {
  var g = props.g;
  var onSelect = props.onSelect;
  var awayC = NFL_TEAM_C[g.away.abbr] || ACCENT;
  var homeC = NFL_TEAM_C[g.home.abbr] || ACCENT;
  var confColor = g.edgeConf>=85?POS_C:g.edgeConf>=75?ACCENT:WARN_C;
  return (
    <div onClick={function(){onSelect(g);}}
      style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
        padding:"12px",minWidth:200,flexShrink:0,cursor:"pointer"}}>
      <div style={{fontSize:8,color:MUTED,marginBottom:6}}>
        {g.time} · {g.network}
      </div>
      <div style={{display:"flex",alignItems:"center",
        justifyContent:"space-between",marginBottom:8}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:900,color:awayC}}>{g.away.abbr}</div>
          <div style={{fontSize:8,color:MUTED}}>Away</div>
        </div>
        <div style={{textAlign:"center",padding:"4px 10px",
          background:CARD3,borderRadius:8}}>
          <div style={{fontSize:9,color:MUTED}}>Spread</div>
          <div style={{fontSize:11,fontWeight:800,color:TEXT}}>{g.spread}</div>
          <div style={{fontSize:9,color:MUTED,marginTop:2}}>O/U {g.total}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:900,color:homeC}}>{g.home.abbr}</div>
          <div style={{fontSize:8,color:MUTED}}>Home</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4,
        padding:"5px 8px",borderRadius:8,
        background:confColor+"14",border:"1px solid "+confColor+"33"}}>
        <span style={{fontSize:8}}>🎯</span>
        <span style={{fontSize:9,fontWeight:700,color:confColor,flex:1,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {g.edge}
        </span>
        <span style={{fontSize:8,color:confColor,fontWeight:700}}>{g.edgeConf}%</span>
      </div>
    </div>
  );
}

function NFLFeaturedCard(props) {
  var onShowModal = props.onShowModal;
  var onFullBreakdown = props.onFullBreakdown;
  var f = NFL_FEATURED;
  return (
    <div style={{margin:"0 14px 14px",background:"rgba(52,211,153,.06)",
      border:"1px solid rgba(52,211,153,.25)",borderRadius:16,padding:"14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <span style={{fontSize:9,fontWeight:800,color:WARN_C,letterSpacing:".1em"}}>
          🏆 TOP EDGE THIS WEEK
        </span>
        <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
          background:POS_C+"22",border:"1px solid "+POS_C+"44",color:POS_C}}>
          {f.grade}
        </span>
      </div>
      <div style={{fontSize:11,color:MUTED,marginBottom:4}}>{f.game}</div>
      <div style={{fontSize:16,fontWeight:900,color:TEXT,marginBottom:8}}>
        {f.bet}
      </div>
      <div style={{fontSize:11,color:TEXT2,lineHeight:1.6,marginBottom:10}}>
        {f.analysis}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Sample Line</div>
          <div style={{fontSize:11,fontWeight:800,color:ACCENT,
            fontFamily:"'IBM Plex Mono',monospace"}}>{f.line}</div>
        </div>
        <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Alt Play</div>
          <div style={{fontSize:10,fontWeight:600,color:TEXT2,lineHeight:1.3}}>
            {f.altPlay}
          </div>
        </div>
      </div>
      <button onClick={function(){
          if(onFullBreakdown){onFullBreakdown();}else{onShowModal();}
        }}
        style={{width:"100%",padding:"10px",borderRadius:12,
          background:POS_C,border:"none",color:"#fff",
          fontSize:12,fontWeight:700,cursor:"pointer"}}>
        Full Breakdown
      </button>
    </div>
  );
}

function NFLMovers(props) {
  var groupArr = useState("QB");
  var group = groupArr[0]; var setGroup = groupArr[1];
  var onSelectPlayer = props.onSelectPlayer;

  var players = NFL_MOVERS[group] || [];
  var hot = players.filter(function(p){return p.hot;});
  var cold = players.filter(function(p){return p.cold;});

  return (
    <div style={{padding:"0 14px 14px"}}>
      <div style={{display:"flex",alignItems:"center",
        justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
          MOVERS THIS WEEK
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
        {["QB","RB","WR","Teams"].map(function(g) {
          var isActive = group===g;
          return (
            <button key={g} onClick={function(){setGroup(g);}}
              style={{padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {g}
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <div style={{fontSize:9,fontWeight:800,color:HOT_C,
            letterSpacing:".1em",marginBottom:8}}>🔥 HOT</div>
          {hot.map(function(p, i) {
            var tc = NFL_TEAM_C[p.team] || ACCENT;
            return (
              <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:12,padding:"10px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:4}}>
                  <div onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                  style={{fontSize:12,fontWeight:700,color:HOT_C,
                    cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                    textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                    textDecorationColor:HOT_C+"66"}}>
                    {p.name}
                  </div>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",
                    borderRadius:6,background:tc+"22",color:tc}}>{p.team}</span>
                </div>
                <div style={{fontSize:9,color:MUTED,marginBottom:2}}>{p.stat}</div>
                <div style={{fontSize:13,fontWeight:900,color:TEXT,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{p.val}</div>
                <div style={{fontSize:9,color:POS_C,marginTop:3}}>{p.trend}</div>
              </div>
            );
          })}
        </div>
        <div>
          <div style={{fontSize:9,fontWeight:800,color:COLD_C,
            letterSpacing:".1em",marginBottom:8}}>❄️ COLD</div>
          {cold.map(function(p, i) {
            var tc = NFL_TEAM_C[p.team] || ACCENT;
            return (
              <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:12,padding:"10px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:4}}>
                  <div onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                  style={{fontSize:12,fontWeight:700,color:COLD_C,
                    cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                    textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                    textDecorationColor:COLD_C+"66"}}>
                    {p.name}
                  </div>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",
                    borderRadius:6,background:tc+"22",color:tc}}>{p.team}</span>
                </div>
                <div style={{fontSize:9,color:MUTED,marginBottom:2}}>{p.stat}</div>
                <div style={{fontSize:13,fontWeight:900,color:TEXT,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{p.val}</div>
                <div style={{fontSize:9,color:NEG_C,marginTop:3}}>{p.trend}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ── HOME TAB ──────────────────────────────────────────────────────────────────
function MoversFilterPanel(props) {
  var filter = props.filter;
  var setFilter = props.setFilter;
  var onClose = props.onClose;
  var teams = ["All","NYY","BOS","LAD","SF","HOU","ATL","TOR","BAL","TEX","TB","PHI","NYM","MIA","MIL","CHC","STL","CIN","PIT","ARI","SD","COL","SEA","LAA","OAK","MIN","CWS","CLE","DET","KC","WSH"];
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,
      background:"rgba(0,0,0,.8)",backdropFilter:"blur(10px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"85vh",overflowY:"auto",padding:"20px 16px 36px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <span style={{fontSize:14,fontWeight:800,color:TEXT}}>Filter Movers</span>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,borderRadius:8,
              width:28,height:28,color:TEXT2,cursor:"pointer",fontSize:14}}>
            x
          </button>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:".1em",
            textTransform:"uppercase",marginBottom:8}}>Time Window</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["7D","14D","30D","Season"].map(function(w) {
              var isActive = filter.window===w;
              return (
                <button key={w} onClick={function(){setFilter(function(f){return Object.assign({},f,{window:w});});}}
                  style={{padding:"6px 14px",borderRadius:14,fontSize:12,fontWeight:600,
                    cursor:"pointer",background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":TEXT2}}>
                  {w}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:".1em",
            textTransform:"uppercase",marginBottom:8}}>Venue</div>
          <div style={{display:"flex",gap:6}}>
            {["All","Home","Away"].map(function(v) {
              var isActive = filter.venue===v;
              return (
                <button key={v} onClick={function(){setFilter(function(f){return Object.assign({},f,{venue:v});});}}
                  style={{padding:"6px 14px",borderRadius:14,fontSize:12,fontWeight:600,
                    cursor:"pointer",background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":TEXT2}}>
                  {v}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:".1em",
            textTransform:"uppercase",marginBottom:8}}>Time of Day</div>
          <div style={{display:"flex",gap:6}}>
            {["All","Day","Night"].map(function(t) {
              var isActive = filter.time===t;
              return (
                <button key={t} onClick={function(){setFilter(function(f){return Object.assign({},f,{time:t});});}}
                  style={{padding:"6px 14px",borderRadius:14,fontSize:12,fontWeight:600,
                    cursor:"pointer",background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":TEXT2}}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:".1em",
            textTransform:"uppercase",marginBottom:8}}>Team</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {teams.map(function(t) {
              var isActive = filter.team===t;
              var tc = TEAM_C[t] || ACCENT;
              return (
                <button key={t} onClick={function(){setFilter(function(f){return Object.assign({},f,{team:t});});}}
                  style={{padding:"5px 10px",borderRadius:10,fontSize:11,fontWeight:600,
                    cursor:"pointer",
                    background:isActive?(t==="All"?ACCENT:tc+"33"):"transparent",
                    border:"1px solid "+(isActive?(t==="All"?ACCENT:tc):BORDER),
                    color:isActive?(t==="All"?"#fff":tc):TEXT2}}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={onClose}
          style={{width:"100%",padding:"12px",borderRadius:12,background:ACCENT,
            border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Apply Filters
        </button>
      </div>
    </div>
  );
}


function HomeTab(props) {
  var onSelectGame = props.onSelectGame;
  var onSelectPlayer = props.onSelectPlayer;
  var sport = props.sport;
  var setSport = props.setSport;
  var timeWindow = props.timeWindow;
  var setTimeWindow = props.setTimeWindow;
  var activeGroupArr = useState("Hitters");
  var activeGroup = activeGroupArr[0];
  var setActiveGroup = activeGroupArr[1];
  var showFilterArr = useState(false);
  var showFilter = showFilterArr[0];
  var setShowFilter = showFilterArr[1];
  var showEdgeModalArr = useState(false);
  var showEdgeModal = showEdgeModalArr[0];
  var setShowEdgeModal = showEdgeModalArr[1];
  var nflGameArr = useState(null);
  var selectedNFLGame = nflGameArr[0];
  var setSelectedNFLGame = nflGameArr[1];
  var nflEdgeModalArr = useState(false);
  var showNFLEdgeModal = nflEdgeModalArr[0];
  var setShowNFLEdgeModal = nflEdgeModalArr[1];
  var filterArr = useState({window:"14D",venue:"All",time:"All",team:"All"});
  var filter = filterArr[0];
  var setFilter = filterArr[1];
  var propsToShow = HOME_GROUPS[activeGroup] || [];
  var filterActive = filter.venue!=="All" || filter.time!=="All" || filter.team!=="All";
  return (
    <div style={{paddingBottom:80,animation:"fadeUp .25s ease"}}>
      {selectedNFLGame && (
        <NFLPreviewModal
          game={selectedNFLGame}
          onClose={function(){setSelectedNFLGame(null);}}
          onFullBreakdown={function(){setSelectedNFLGame(null);onSelectGame(selectedNFLGame);}}/>
      )}
      {showNFLEdgeModal && (
        <NFLFeaturedEdgeModal
          onClose={function(){setShowNFLEdgeModal(false);}}
          onFullBreakdown={function(){setShowNFLEdgeModal(false);onSelectGame(NFL_SLATE[0]);}}/>
      )}
      {showEdgeModal && (
        <FeaturedEdgeModal
          onClose={function(){setShowEdgeModal(false);}}
          onFullBreakdown={function(){setShowEdgeModal(false);onSelectGame(SLATE_GAMES[0]);}}/>
      )}
      <ShellHeader sport={sport} setSport={setSport}/>
      {sport==="mlb" && <ShellTicker/>}
      {sport==="nfl" && <NFLTicker/>}

      {sport==="mlb" && (
        <div style={{padding:"14px 0 0"}}>
          <FeaturedEdgeCard onSelectGame={onSelectGame} onShowModal={function(){setShowEdgeModal(true);}}/>
          <GamesStrip onSelectGame={onSelectGame}/>
        <div style={{padding:"0 14px"}}>
          {showFilter && (
            <MoversFilterPanel filter={filter} setFilter={setFilter}
              onClose={function(){setShowFilter(false);}}/>
          )}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            marginBottom:14}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".15em"}}>
              MOVERS
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9,color:MUTED,fontFamily:"'IBM Plex Mono',monospace"}}>
                {filter.window}
                {filter.venue!=="All"?" · "+filter.venue:""}
                {filter.time!=="All"?" · "+filter.time:""}
                {filter.team!=="All"?" · "+filter.team:""}
              </span>
              <button onClick={function(){setShowFilter(true);}}
                style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                  borderRadius:14,fontSize:10,fontWeight:600,cursor:"pointer",
                  background:filterActive?ACCENT+"22":"transparent",
                  border:"1px solid "+(filterActive?ACCENT:BORDER),
                  color:filterActive?ACCENT:MUTED}}>
                Filter {filterActive?"(on)":""}
              </button>
            </div>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:16,
            background:CARD,borderRadius:12,padding:4,
            border:"1px solid "+BORDER}}>
            {["Hitters","Pitchers","Teams"].map(function(g) {
              var isActive = activeGroup===g;
              return (
                <button key={g} onClick={function(){setActiveGroup(g);}}
                  style={{flex:1,padding:"7px 4px",borderRadius:9,
                    fontSize:11,fontWeight:isActive?700:500,cursor:"pointer",
                    background:isActive?ACCENT:"transparent",
                    border:"none",color:isActive?"#fff":MUTED}}>
                  {g==="Hitters"?"🔥 Hitters":g==="Pitchers"?"⚾ Pitchers":"🏟 Teams"}
                </button>
              );
            })}
          </div>
          {propsToShow.map(function(pk) {
            return (
              <HomeTilePair key={pk+"-"+activeGroup}
                propKey={pk} timeWindow={filter.window}/>
            );
          })}
        </div>
      </div>
      )}

      {sport==="nfl" && (
        <div style={{padding:"14px 0 0"}}>
          <NFLFeaturedCard onShowModal={function(){setShowNFLEdgeModal(true);}} onFullBreakdown={function(){onSelectGame(NFL_SLATE[0]);}}/>
          <div style={{display:"flex",gap:10,overflowX:"auto",
            padding:"0 14px 14px"}}>
            {NFL_SLATE.map(function(g) {
              return (<NFLGameChip key={g.id} g={g} onSelect={function(game){setSelectedNFLGame(game);}}/>);
            })}
          </div>
          <NFLMovers onSelectPlayer={props.onSelectPlayer}/>
        </div>
      )}
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav(props) {
  var active = props.active;
  var onChange = props.onChange;
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,
      background:"rgba(8,13,24,.97)",backdropFilter:"blur(20px)",
      borderTop:"1px solid "+BORDER,
      display:"flex",justifyContent:"space-around",
      padding:"8px 0 20px",zIndex:200}}>
      {NAV.map(function(item) {
        var isActive = active===item.id;
        return (
          <button key={item.id} onClick={function(){onChange(item.id);}}
            style={{display:"flex",flexDirection:"column",alignItems:"center",
              gap:3,background:"none",border:"none",cursor:"pointer",
              padding:"4px 16px",minWidth:60}}>
            <span style={{fontSize:20}}>{item.icon}</span>
            <span style={{fontSize:9,fontWeight:isActive?700:500,
              color:isActive?ACCENT:MUTED,letterSpacing:".04em"}}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── GAMES TAB ─────────────────────────────────────────────────────────────────
function GamesTab(props) {
  var onSelectGame = props.onSelectGame;
  var sport = props.sport || "mlb";
  var nflGameArr = useState(null);
  var selectedNFLGame = nflGameArr[0];
  var setSelectedNFLGame = nflGameArr[1];

  return (
    <div style={{padding:"14px",paddingBottom:80,animation:"fadeUp .25s ease"}}>
      {selectedNFLGame && (
        <NFLPreviewModal
          game={selectedNFLGame}
          onClose={function(){setSelectedNFLGame(null);}}
          onFullBreakdown={function(){setSelectedNFLGame(null);onSelectGame(selectedNFLGame);}}/>
      )}

      {sport==="mlb" && (
        <div>
          <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:4}}>
            Today's Slate
          </div>
          <div style={{fontSize:11,color:MUTED,marginBottom:16}}>Jun 22</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {SLATE_GAMES.map(function(g) {
              var isLive = g.status==="Live";
              var edgeColor = g.edges>=3?POS_C:g.edges>=2?ACCENT:TEXT2;
              var edgeBg = g.edges>=3?"rgba(52,211,153,.1)":g.edges>=2?"rgba(77,159,255,.1)":"rgba(255,255,255,.04)";
              return (
                <div key={g.id} onClick={function(){onSelectGame(g);}}
                  style={{background:CARD,border:"1px solid "+BORDER,borderRadius:16,
                    padding:"14px",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:16,fontWeight:900,color:g.away.c}}>
                        {g.away.abbr}
                      </span>
                      <div style={{textAlign:"center"}}>
                        {isLive ? (
                          <div style={{display:"flex",alignItems:"center",gap:4,
                            fontSize:10,fontWeight:700,color:NEG_C}}>
                            <div style={{width:6,height:6,borderRadius:"50%",
                              background:NEG_C,animation:"pulse 1.5s infinite"}}/>
                            LIVE
                          </div>
                        ) : (
                          <div style={{fontSize:11,color:MUTED}}>{g.time}</div>
                        )}
                        <div style={{fontSize:11,color:TEXT2,fontWeight:600}}>
                          O/U {g.total}
                        </div>
                      </div>
                      <span style={{fontSize:16,fontWeight:900,color:g.home.c}}>
                        {g.home.abbr}
                      </span>
                    </div>
                    <div style={{padding:"5px 12px",borderRadius:12,fontSize:11,
                      fontWeight:700,background:edgeBg,
                      border:"1px solid "+edgeColor+"44",color:edgeColor}}>
                      {g.edges} edge{g.edges!==1?"s":""}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:MUTED,marginBottom:8}}>
                    {g.ap} vs {g.hp}
                  </div>
                  <div style={{height:3,borderRadius:2,background:BORDER2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:g.winProb+"%",
                      background:"linear-gradient(90deg,"+g.away.c+","+g.home.c+")",
                      borderRadius:2}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sport==="nfl" && (
        <div>
          <div style={{fontSize:16,fontWeight:800,color:TEXT,marginBottom:4}}>
            This Week's Games
          </div>
          <div style={{fontSize:11,color:MUTED,marginBottom:16}}>
            NFL — Week 18
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {NFL_SLATE.map(function(g) {
              var awayC = NFL_TEAM_C[g.away.abbr] || ACCENT;
              var homeC = NFL_TEAM_C[g.home.abbr] || ACCENT;
              var edges = NFL_GAME_EDGES[g.id] || [];
              var edgeCount = edges.length;
              var edgeColor = edgeCount>=3?POS_C:edgeCount>=2?ACCENT:TEXT2;
              var edgeBg = edgeCount>=3?"rgba(52,211,153,.1)":
                           edgeCount>=2?"rgba(77,159,255,.1)":"rgba(255,255,255,.04)";
              var confColor = g.edgeConf>=85?POS_C:g.edgeConf>=75?ACCENT:WARN_C;
              return (
                <div key={g.id} onClick={function(){setSelectedNFLGame(g);}}
                  style={{background:CARD,border:"1px solid "+BORDER,
                    borderRadius:16,padding:"14px",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:900,color:awayC}}>
                          {g.away.abbr}
                        </div>
                        <div style={{fontSize:8,color:MUTED}}>Away</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:9,color:MUTED,marginBottom:2}}>
                          {g.time}
                        </div>
                        <div style={{background:CARD3,borderRadius:8,
                          padding:"4px 10px"}}>
                          <div style={{fontSize:11,fontWeight:800,color:TEXT}}>
                            {g.spread}
                          </div>
                          <div style={{fontSize:9,color:MUTED}}>O/U {g.total}</div>
                        </div>
                        <div style={{fontSize:8,color:MUTED,marginTop:2}}>
                          {g.network}
                        </div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:900,color:homeC}}>
                          {g.home.abbr}
                        </div>
                        <div style={{fontSize:8,color:MUTED}}>Home</div>
                      </div>
                    </div>
                    <div style={{padding:"5px 12px",borderRadius:12,fontSize:11,
                      fontWeight:700,background:edgeBg,
                      border:"1px solid "+edgeColor+"44",color:edgeColor}}>
                      {edgeCount} edge{edgeCount!==1?"s":""}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,
                    padding:"7px 10px",borderRadius:10,
                    background:confColor+"12",
                    border:"1px solid "+confColor+"33",marginBottom:8}}>
                    <span style={{fontSize:10}}>🎯</span>
                    <span style={{fontSize:10,fontWeight:700,color:confColor,
                      flex:1,overflow:"hidden",textOverflow:"ellipsis",
                      whiteSpace:"nowrap"}}>{g.edge}</span>
                    <span style={{fontSize:9,fontWeight:700,color:confColor}}>
                      {g.edgeConf}%
                    </span>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <div style={{flex:1,textAlign:"center",padding:"5px",
                      background:CARD3,borderRadius:8}}>
                      <div style={{fontSize:9,color:MUTED}}>Away ML</div>
                      <div style={{fontSize:11,fontWeight:700,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.awayML}</div>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:"5px",
                      background:CARD3,borderRadius:8}}>
                      <div style={{fontSize:9,color:MUTED}}>Win Prob</div>
                      <div style={{fontSize:11,fontWeight:700,color:ACCENT,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.winProb}%</div>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:"5px",
                      background:CARD3,borderRadius:8}}>
                      <div style={{fontSize:9,color:MUTED}}>Home ML</div>
                      <div style={{fontSize:11,fontWeight:700,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.homeML}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sport!=="mlb" && sport!=="nfl" && (
        <div style={{padding:"40px 20px",textAlign:"center",color:MUTED,fontSize:12}}>
          {sport.toUpperCase()} games coming soon.
        </div>
      )}
    </div>
  );
}

// ── SIGNAL CARD ───────────────────────────────────────────────────────────────
function SignalCard(props) {
  var f = props.f;
  var onInfo = props.onInfo;
  var strength = Math.abs(f.score) * f.weight;
  var isPos = f.score > 0;
  var isNeg = f.score < 0;
  var color = isPos ? POS_C : isNeg ? NEG_C : MUTED;
  var bg = isPos?"rgba(52,211,153,.07)":isNeg?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
  var border = isPos?"rgba(52,211,153,.2)":isNeg?"rgba(255,90,90,.2)":BORDER;
  var strengthLabel = strength>=8?"Strong":strength>=5?"Moderate":"Minor";
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
      background:bg,border:"1px solid "+border,borderRadius:10,marginBottom:6}}>
      <div style={{width:24,height:24,borderRadius:8,background:color+"22",
        border:"1px solid "+color+"44",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0}}>
        <span style={{fontSize:13,color:color,fontWeight:800}}>
          {isPos?"v":isNeg?"x":"-"}
        </span>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <span style={{fontSize:11,fontWeight:600,color:TEXT,lineHeight:1.3}}>
          {f.label}
        </span>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
          <span style={{fontSize:9,fontWeight:700,color:color,padding:"1px 7px",
            borderRadius:10,background:color+"18"}}>
            {isNeg?"Risk: ":""}{strengthLabel}
          </span>
          <span style={{fontSize:9,color:MUTED}}>wt {f.weight}/10</span>
        </div>
      </div>
      {f.why && (
        <span onClick={function(e){e.stopPropagation();onInfo && onInfo(f);}}
          style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
            width:20,height:20,borderRadius:"50%",
            background:"rgba(77,159,255,.15)",
            border:"1px solid rgba(77,159,255,.4)",
            cursor:"pointer",fontSize:10,color:ACCENT,
            fontWeight:700,flexShrink:0}}>
          i
        </span>
      )}
    </div>
  );
}

// ── EDGE CARD ─────────────────────────────────────────────────────────────────
function EdgeCard(props) {
  var edge = props.edge;
  var idx = props.idx;
  var onInfo = props.onInfo;
  var openArr = useState(idx===0);
  var open = openArr[0];
  var setOpen = openArr[1];
  var sectionArr = useState("analysis");
  var section = sectionArr[0];
  var setSection = sectionArr[1];
  var catColor = edge.type==="side"?POS_C:edge.type==="total"?ACCENT:WARN_C;
  var catLabel = edge.type==="side"?"Game Lines":edge.type==="total"?"Totals":"Props";
  var posF = (edge.factors||[]).filter(function(f){return f.score>0;}).length;
  var negF = (edge.factors||[]).filter(function(f){return f.score<0;}).length;
  var neutralF = (edge.factors||[]).filter(function(f){return f.score===0;}).length;
  return (
    <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
      marginBottom:10,overflow:"hidden"}}>
      <div onClick={function(){setOpen(!open);}}
        style={{padding:"12px 14px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <GradeChip grade={edge.grade}/>
            <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{edge.bet}</span>
          </div>
          <span style={{color:TEXT2,fontSize:12}}>{open?"▲":"▼"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          {edge.team && <TeamBadge abbr={edge.team}/>}
          <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
            background:catColor+"22",border:"1px solid "+catColor+"44",color:catColor}}>
            {catLabel}
          </span>
        </div>
        <ConfBar pct={edge.conf}/>
      </div>
      {open && (
        <div style={{borderTop:"1px solid "+BORDER}}>
          <div style={{display:"flex",borderBottom:"1px solid "+BORDER}}>
            {[["analysis","Analysis"],["signals","Signals"],["lines","Lines"]].map(function(item) {
              var id = item[0];
              var label = item[1];
              var isActive = section===id;
              return (
                <button key={id}
                  onClick={function(e){e.stopPropagation();setSection(id);}}
                  style={{flex:1,padding:"8px 4px",fontSize:10,fontWeight:600,
                    cursor:"pointer",border:"none",
                    background:isActive?CARD2:"transparent",
                    color:isActive?TEXT:MUTED,
                    borderBottom:isActive?"2px solid "+catColor:"2px solid transparent",
                    transition:"all .15s"}}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{padding:"12px 14px"}}>
            {section==="analysis" && (
              <div>
                <div style={{fontSize:9,fontWeight:700,color:ACCENT,
                  letterSpacing:".1em",marginBottom:6}}>
                  EDGEVIEW ANALYSIS
                </div>
                <div style={{fontSize:11,color:TEXT2,lineHeight:1.7,marginBottom:10}}>
                  {edge.analysis}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {(edge.stats||[]).map(function(s, i) {
                    return (
                      <div key={i} style={{padding:"3px 9px",borderRadius:10,
                        background:s.good?POS_C+"12":NEG_C+"10",
                        border:"1px solid "+(s.good?"rgba(52,211,153,.25)":"rgba(255,90,90,.22)")}}>
                        <span style={{fontSize:9,color:TEXT2}}>{s.label}: </span>
                        <span style={{fontSize:10,fontWeight:700,
                          color:s.good?POS_C:NEG_C,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {section==="signals" && (
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                  {[[POS_C,"For",posF],[MUTED,"Neutral",neutralF],[NEG_C,"Risk",negF]].map(function(item) {
                    var c = item[0]; var l = item[1]; var n = item[2];
                    return (
                      <div key={l} style={{textAlign:"center",padding:"8px 6px",
                        background:CARD3,borderRadius:10}}>
                        <div style={{fontSize:16,fontWeight:800,color:c}}>{n}</div>
                        <div style={{fontSize:9,color:MUTED}}>{l}</div>
                      </div>
                    );
                  })}
                </div>
                {(edge.factors||[]).map(function(f, i) {
                  return (<SignalCard key={i} f={f} onInfo={onInfo}/>);
                })}
              </div>
            )}
            {section==="lines" && (
              <div>
                <div style={{padding:"10px 12px",background:CARD3,borderRadius:10}}>
                  <div style={{fontSize:10,color:MUTED,marginBottom:4}}>Sample Line</div>
                  <div style={{fontSize:14,fontWeight:800,color:ACCENT,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {edge.line}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ANALYSIS TAB ──────────────────────────────────────────────────────────────
// ── ANALYSIS TAB DATA ─────────────────────────────────────────────────────────
var MATCHUP_STATS = {
  away:{
    name:"Brayan Bello", hot:false,
    era:"3.84", fip:"4.18", k9:"8.4", xfip:"4.61",
    whip:"1.28", csw:"27.4%", bb9:"3.2",
    eraGood:false, fipGood:false, k9Good:false, xfipGood:false,
  },
  home:{
    name:"Gerrit Cole", hot:true,
    era:"2.91", fip:"2.44", k9:"11.4", xfip:"2.88",
    whip:"0.98", csw:"34.1%", bb9:"1.8",
    eraGood:true, fipGood:true, k9Good:true, xfipGood:true,
  },
  context:[
    {label:"Win Prob",  val:"NYY 62%",      color:"#4d9fff"},
    {label:"H2H 2025",  val:"NYY 6-4",      color:"#34d399"},
    {label:"Under Rate",val:"80% last 10",  color:"#4d9fff"},
    {label:"Ump Zone",  val:"Tight -2.2%",  color:"#fbbf24"},
  ],
};

var FULL_EDGES = [
  {
    id:1, icon:"💰", bet:"NYY Money Line", team:"NYY", type:"side",
    grade:"A", conf:100, supporting:8, line:"DK: NYY -148",
    altPlay:"NYY First 5 Innings ML typically -115 to -125",
    analysis:"Cole's ERA-FIP alignment signals genuine dominance, not luck. The BOS bullpen is taxed and their lineup has the highest K rate vs RHP in the AL over the last 14 days. This is a convergence of starter quality, bullpen advantage, and lineup mismatch.",
    bullets:[
      "Cole ERA 2.91 · FIP 2.44 · xFIP 2.88 — all elite, no regression risk",
      "BOS road lineup K rate 28.1% — AL top-5 most susceptible to Cole's arsenal",
      "Cole CSW% 34.1% vs this specific lineup — 6+ pts above avg",
      "NYY 7-1 at home last 8 games, 7-2 ATS",
    ],
    factors:[
      {label:"Cole ERA vs FIP",score:1,weight:9,why:"ERA 2.91 / FIP 2.44 — genuine dominance confirmed"},
      {label:"BOS road K rate",score:1,weight:8,why:"28.1% vs RHP on road — AL top-5"},
      {label:"NYY home streak",score:1,weight:7,why:"7-1 last 8, scoring 6.2 R/G"},
      {label:"BOS bullpen health",score:-1,weight:6,why:"62/100 — taxed 3 of last 4 nights"},
      {label:"Umpire zone",score:-1,weight:4,why:"Tight zone -2.2% — slight K suppression"},
    ],
  },
  {
    id:2, icon:"📉", bet:"Full Game Under 8.5", team:"", type:"total",
    grade:"A", conf:94, supporting:6, line:"DK: Under 8.5 -112",
    altPlay:"F5 Under 4.5 typically -118 to -125",
    analysis:"Cole projects for a low-run start. BOS road offense is suppressed at 3.1 R/G. Wind blowing IN reduces HR upside. Bello's deep count tendencies favor fewer runs early.",
    bullets:[
      "Cole K/9 of 11.4 limits base runners and scoring chances",
      "BOS averaging 3.1 R/G in last 9 road starts",
      "Wind blowing IN at 8mph — HR suppressed by ~15%",
      "Under hit in 8 of Cole's last 10 home starts",
    ],
    factors:[
      {label:"Cole K projection",score:1,weight:8,why:"11.4 K/9 limits run scoring"},
      {label:"BOS road offense",score:1,weight:7,why:"3.1 R/G last 9 away games"},
      {label:"Wind IN",score:1,weight:6,why:"8mph in — HR suppressed 15%"},
      {label:"Bello xFIP gap",score:-1,weight:5,why:"4.61 xFIP vs 3.84 ERA — regression risk"},
    ],
  },
  {
    id:3, icon:"⚾", bet:"Cole Over 8.5 K", team:"NYY", type:"props",
    grade:"A", conf:100, supporting:9, line:"DK: Cole Over 8.5 K -118",
    altPlay:"Cole Over 7.5 K at better value (-138)",
    analysis:"Cole has cleared 8.5 Ks in 6 of his last 8 starts. BOS lineup strikes out at 28.1% on the road vs RHP. Tonight's umpire has a slightly tighter zone but not enough to change the projection.",
    bullets:[
      "Cole averages 11.4 K/9 — projects 8-10 Ks tonight",
      "BOS road K rate 28.1% vs RHP — highest in AL last 14 days",
      "Cole CSW% vs BOS this season: 34.1% — elite chase rate",
      "6 of last 8 starts: 9+ Ks vs left-heavy lineups",
    ],
    factors:[
      {label:"Cole CSW% vs BOS",score:1,weight:9,why:"34.1% — 6+ pts above his season avg"},
      {label:"BOS road K rate",score:1,weight:8,why:"28.1% on road vs RHP — AL top-5"},
      {label:"Cole avg IP vs BOS",score:1,weight:7,why:"6.8 avg IP — enough volume for 8.5"},
      {label:"Umpire zone",score:-1,weight:4,why:"Tight zone costs ~0.5 Ks per start"},
      {label:"BOS hot bats",score:-1,weight:3,why:"Yoshida/Devers on streak — minor risk"},
    ],
  },
  {
    id:4, icon:"🎯", bet:"Juan Soto Anytime Hit", team:"NYY", type:"props",
    grade:"A", conf:90, supporting:5, line:"DK: Soto Anytime Hit -165",
    altPlay:"Soto Over 1.5 TB at +115",
    analysis:"Soto is batting .312 and has hit safely in 11 of his last 12 games. Bello's 27.4% CSW% against LHH is below average, and Soto has torched Bello historically.",
    bullets:[
      "Soto .412 BA last 14 days, 11-hit streak",
      "Bello vs LHH CSW% 24.1% — well below average",
      "H2H: Soto 6-for-14 (.429) vs Bello career",
      "Yankee Stadium favorable for LHH contact",
    ],
    factors:[
      {label:"Soto recent form",score:1,weight:8,why:".412 BA last 14 days — elite contact streak"},
      {label:"Bello vs LHH",score:1,weight:7,why:"CSW% 24.1% vs LHH — gives up contact"},
      {label:"H2H history",score:1,weight:6,why:"Soto 6-for-14 career vs Bello"},
      {label:"Park factor",score:1,weight:4,why:"Yankee Stadium LHH contact rate +8%"},
    ],
  },
  {
    id:5, icon:"📈", bet:"NYY -1.5 Run Line", team:"NYY", type:"side",
    grade:"A", conf:87, supporting:5, line:"DK: NYY -1.5 +112",
    altPlay:"NYY -1.5 F5 at +145",
    analysis:"NYY has covered -1.5 in 7 of their last 10 home games when Cole starts. BOS bullpen is taxed and likely to give up late runs.",
    bullets:[
      "NYY 7-2-1 ATS last 10 home Cole starts",
      "BOS bullpen ERA 4.21 last 7 days",
      "NYY averaging +2.1 run differential at home",
      "Cole avg 6.8 IP — deep into games limits BOS rally chances",
    ],
    factors:[
      {label:"NYY ATS at home",score:1,weight:8,why:"7-2-1 last 10 home Cole starts"},
      {label:"BOS bullpen",score:1,weight:7,why:"ERA 4.21 last 7 days — late runs likely"},
      {label:"Run differential",score:1,weight:6,why:"+2.1 avg margin at home this month"},
      {label:"Umpire impact",score:-1,weight:3,why:"Tight zone slightly suppresses run totals"},
    ],
  },
  {
    id:6, icon:"💣", bet:"Aaron Judge To Hit HR", team:"NYY", type:"props",
    grade:"A", conf:86, supporting:5, line:"DK: Judge HR +280",
    altPlay:"Judge Over 1.5 TB -118",
    analysis:"Judge has homered in 3 of his last 5 starts vs LHP and RHP alike. Bello's HR/9 of 1.1 is above league average. Wind is blowing IN but Judge's raw power overcomes park factors.",
    bullets:[
      "Judge 3 HR last 5 games, 26% HR rate last 14 days",
      "Bello HR/9 of 1.1 — above league average 1.0",
      "Judge vs Bello career: 2 HR in 9 AB (.444 SLG)",
      "Yankee Stadium LHH HR factor +21% even with wind IN",
    ],
    factors:[
      {label:"Judge HR streak",score:1,weight:8,why:"3 HR last 5 games — elite power form"},
      {label:"Bello HR/9",score:1,weight:7,why:"1.1 HR/9 — vulnerable to power hitters"},
      {label:"H2H vs Bello",score:1,weight:5,why:"2 HR in 9 career AB vs Bello"},
      {label:"Wind blowing IN",score:-1,weight:4,why:"Slight suppression but Judge power overcomes"},
    ],
  },
  {
    id:7, icon:"0️⃣", bet:"NRFI — No Run First Inning", team:"", type:"total",
    grade:"A", conf:85, supporting:4, line:"DK: NRFI -135",
    altPlay:"F1 Under 0.5 Runs each team at -118/-125",
    analysis:"Cole allows 0 first-inning runs in 78% of starts. Bello is strong in the first inning with a 1.42 F1 ERA. Both lineups tend to work into counts early.",
    bullets:[
      "Cole 0 F1 ER in 78% of 2025 starts",
      "Bello F1 ERA 1.42 — dominant early",
      "BOS leadoff Yoshida .198 AVG vs RHP last 14D",
      "NYY leadoff Judge tends to work deep counts in F1",
    ],
    factors:[
      {label:"Cole F1 ERA",score:1,weight:8,why:"0 F1 ER in 78% of starts this season"},
      {label:"Bello F1 ERA",score:1,weight:7,why:"1.42 F1 ERA — strong early innings"},
      {label:"BOS leadoff form",score:1,weight:5,why:"Yoshida .198 vs RHP last 14 days"},
      {label:"NYY deep count tendency",score:-1,weight:3,why:"Judge works counts — risk of run on error"},
    ],
  },
  {
    id:8, icon:"📈", bet:"Rafael Devers Over 1.5 Hits+Runs+RBI", team:"BOS", type:"props",
    grade:"A", conf:84, supporting:4, line:"DK: Devers H+R+RBI Over 1.5 -128",
    altPlay:"Devers Anytime Hit -175",
    analysis:"Devers is one of the most active hitters in the lineup with 4.2 combined H+R+RBI per game last 14 days. Even in a low-scoring game, Devers produces.",
    bullets:[
      "Devers 4.2 H+R+RBI per game last 14 days",
      "Devers vs Cole: .312 career BA, 2 HR in 16 AB",
      "BOS 2-hole hitter with RBI opportunities vs NYY power lineup",
      "Cole allows more contact to LHH when ahead in count",
    ],
    factors:[
      {label:"Devers recent form",score:1,weight:8,why:"4.2 H+R+RBI per game last 14 days"},
      {label:"H2H vs Cole",score:1,weight:6,why:".312 career BA vs Cole in 16 AB"},
      {label:"Lineup position",score:1,weight:5,why:"2-hole — high RBI opportunity"},
      {label:"Cole LHH tendency",score:-1,weight:4,why:"Allows more contact when ahead in count"},
    ],
  },
  {
    id:9, icon:"🔥", bet:"Rafael Devers Over 1.5 Total Bases", team:"BOS", type:"props",
    grade:"A-", conf:83, supporting:4, line:"DK: Devers Over 1.5 TB -138",
    altPlay:"Devers Over 0.5 HR +360",
    analysis:"Devers has exceeded 1.5 total bases in 9 of his last 14 games. His .512 xSLG indicates he's been hitting the ball hard and is primed for extra-base contact.",
    bullets:[
      "Devers 1.5+ TB in 9 of last 14 games (64%)",
      "xSLG .512 — significantly above actual SLG",
      "Bello hard hit% 42.8% — one of higher in AL",
      "Yankee Stadium LHH TB factor +12%",
    ],
    factors:[
      {label:"Devers TB streak",score:1,weight:7,why:"1.5+ TB in 9 of 14 games (64% rate)"},
      {label:"xSLG vs actual",score:1,weight:6,why:".512 xSLG — hard contact overdue for XBH"},
      {label:"Bello hard hit%",score:1,weight:5,why:"42.8% hard hit — Devers profiles well"},
      {label:"Park factor",score:1,weight:3,why:"Yankee Stadium LHH TB +12%"},
    ],
  },
];

// Parlay combinations
var PARLAY_COMBOS = {
  2:[
    {legs:["Cole Over 8.5 K","NYY Money Line"],prob:96,odds:"-178",label:"Best Combo"},
    {legs:["NRFI","Under 8.5"],prob:91,odds:"-225",label:"Safe Play"},
    {legs:["Cole Over 8.5 K","Soto Anytime Hit"],prob:90,odds:"-148",label:"Value Play"},
  ],
  3:[
    {legs:["NYY Money Line","Cole Over 8.5 K","Soto Anytime Hit"],prob:88,odds:"+145",label:"Best Combo"},
    {legs:["NYY Money Line","Under 8.5","NRFI"],prob:85,odds:"+165",label:"Under Stack"},
    {legs:["NYY Money Line","Cole Over 8.5 K","NRFI"],prob:83,odds:"+185",label:"Pitcher Special"},
  ],
  4:[
    {legs:["Under 8.5","NYY TT Over 4.5","Soto Anytime Hit","NRFI"],prob:68,odds:"-209",label:"Best Combo"},
    {legs:["NYY ML","Cole Over 8.5 K","Soto Anytime Hit","NRFI"],prob:64,odds:"+240",label:"NYY Stack"},
  ],
  5:[
    {legs:["NYY ML","Cole Over 8.5 K","Soto Hit","Judge HR","NRFI"],prob:51,odds:"+820",label:"Best Combo"},
  ],
};

var BET_TYPE_OPTS = [
  {id:"ml",label:"ML / Run Line",icon:"📈"},
  {id:"ou",label:"Full Game O/U",icon:"📋"},
  {id:"f5",label:"First 5 Innings",icon:"5️⃣"},
  {id:"nrfi",label:"NRFI",icon:"0️⃣"},
  {id:"tt",label:"Team Totals",icon:"🏠"},
  {id:"k",label:"Strikeout Props",icon:"⚾"},
  {id:"hr",label:"HR Props",icon:"💣"},
  {id:"tb",label:"Total Bases",icon:"📐"},
  {id:"hit",label:"Anytime Hit",icon:"🎯"},
  {id:"runs",label:"Runs Scored",icon:"🏃"},
  {id:"walks",label:"Walks",icon:"🚶"},
  {id:"hrbi",label:"H+R+RBI",icon:"📊"},
];

// ── MATCHUP OVERVIEW ──────────────────────────────────────────────────────────
function MatchupOverview(props) {
  var onOpenSummary = props.onOpenSummary;
  var gd = GAME_DATA;
  var away = MATCHUP_STATS.away;
  var home = MATCHUP_STATS.home;

  function StatBox(sp) {
    var label = sp.label; var val = sp.val; var good = sp.good;
    var color = good ? POS_C : NEG_C;
    var bg = good ? "rgba(52,211,153,.08)" : "rgba(255,90,90,.08)";
    var border = good ? "rgba(52,211,153,.2)" : "rgba(255,90,90,.2)";
    return (
      <div style={{background:bg,border:"1px solid "+border,borderRadius:10,
        padding:"8px 6px",textAlign:"center"}}>
        <div style={{fontSize:9,color:MUTED,marginBottom:4,display:"flex",
          alignItems:"center",justifyContent:"center",gap:3}}>
          {label}
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
            width:12,height:12,borderRadius:"50%",background:ACCENT+"22",
            fontSize:7,color:ACCENT,cursor:"pointer"}}>i</span>
        </div>
        <div style={{fontSize:20,fontWeight:900,color:color,
          fontFamily:"'IBM Plex Mono',monospace"}}>{val}</div>
      </div>
    );
  }

  function PitcherCard(sp) {
    var p = sp.p; var side = sp.side; var abbr = sp.abbr;
    var tc = TEAM_C[abbr] || ACCENT;
    return (
      <div style={{flex:1,background:CARD3,borderRadius:12,padding:"10px",
        border:"2px solid "+tc+"44"}}>
        <div style={{fontSize:9,color:MUTED,marginBottom:4}}>
          {abbr} Starting Pitcher
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:800,color:TEXT}}>{p.name}</span>
          <span style={{fontSize:12}}>{p.hot ? "🔥" : "❄️"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
          <StatBox label="ERA" val={p.era} good={p.eraGood}/>
          <StatBox label="FIP" val={p.fip} good={p.fipGood}/>
          <StatBox label="K/9" val={p.k9} good={p.k9Good}/>
          <StatBox label="xFIP" val={p.xfip} good={p.xfipGood}/>
        </div>
        <div style={{borderTop:"1px solid "+BORDER,paddingTop:8}}>
          {[["WHIP",p.whip],["CSW%",p.csw],["BB/9",p.bb9]].map(function(row) {
            return (
              <div key={row[0]} style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:3}}>
                  <span style={{fontSize:9,color:MUTED}}>{row[0]}</span>
                  <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                    width:11,height:11,borderRadius:"50%",background:ACCENT+"22",
                    fontSize:6,color:ACCENT,cursor:"pointer"}}>i</span>
                </div>
                <span style={{fontSize:10,fontWeight:700,color:TEXT2,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{row[1]}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
      padding:"12px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10}}>🤖</span>
          <span style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
            MATCHUP OVERVIEW
          </span>
        </div>
        <button onClick={onOpenSummary}
          style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
            borderRadius:10,background:POS_C+"18",border:"1px solid "+POS_C+"33",
            cursor:"pointer"}}>
          <span style={{fontSize:9}}>📊</span>
          <span style={{fontSize:10,fontWeight:700,color:POS_C}}>Game Summary</span>
        </button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <PitcherCard p={away} side="away" abbr={GAME_DATA.away.abbr}/>
        <PitcherCard p={home} side="home" abbr={GAME_DATA.home.abbr}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
        {MATCHUP_STATS.context.map(function(c) {
          return (
            <div key={c.label} style={{textAlign:"center",padding:"6px 4px",
              background:CARD3,borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:800,color:c.color,
                fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{c.val}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:2}}>
                <span style={{fontSize:8,color:MUTED}}>{c.label}</span>
                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                  width:10,height:10,borderRadius:"50%",background:ACCENT+"22",
                  fontSize:6,color:ACCENT,cursor:"pointer"}}>i</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TOP EDGE CARD ─────────────────────────────────────────────────────────────
function TopEdgeCard(props) {
  var edge = props.edge;
  var catColor = edge.type==="side"?POS_C:edge.type==="total"?ACCENT:WARN_C;
  var catLabel = edge.type==="side"?"Game Lines":edge.type==="total"?"Totals":"Player Props";
  return (
    <div style={{background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.25)",
      borderRadius:14,padding:"14px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <span style={{fontSize:9,fontWeight:800,color:WARN_C,letterSpacing:".1em"}}>
          🏆 TOP EDGE TONIGHT
        </span>
        <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
          background:catColor+"22",border:"1px solid "+catColor+"44",color:catColor}}>
          📈 {catLabel}
        </span>
      </div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>{edge.icon}</span>
          <span style={{fontSize:16,fontWeight:900,color:TEXT}}>{edge.bet}</span>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
          <div style={{fontSize:14,fontWeight:900,color:POS_C}}>A</div>
          <div style={{fontSize:8,color:MUTED}}>Grade</div>
        </div>
      </div>
      {edge.team && (
        <TeamBadge abbr={edge.team}/>
      )}
      <div style={{fontSize:11,color:TEXT2,lineHeight:1.6,marginTop:8,marginBottom:10}}>
        {edge.analysis}
      </div>
      <div style={{marginBottom:10}}>
        {edge.bullets.map(function(b, i) {
          return (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4}}>
              <span style={{color:POS_C,fontSize:10,marginTop:1,flexShrink:0}}>•</span>
              <span style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>{b}</span>
            </div>
          );
        })}
      </div>
      <ConfBar pct={edge.conf}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
        <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Sample Line</div>
          <div style={{fontSize:11,fontWeight:800,color:ACCENT,
            fontFamily:"'IBM Plex Mono',monospace"}}>{edge.line}</div>
        </div>
        <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Alt Play</div>
          <div style={{fontSize:10,fontWeight:700,color:TEXT2,lineHeight:1.3}}>
            {edge.altPlay}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FULL EDGE CARD ────────────────────────────────────────────────────────────
function FullEdgeCard(props) {
  var edge = props.edge;
  var idx = props.idx;
  var onInfo = props.onInfo;
  var openArr = useState(false);
  var open = openArr[0]; var setOpen = openArr[1];
  var sectionArr = useState("analysis");
  var section = sectionArr[0]; var setSection = sectionArr[1];
  var catColor = edge.type==="side"?POS_C:edge.type==="total"?ACCENT:WARN_C;
  var catLabel = edge.type==="side"?"Game Lines":edge.type==="total"?"Totals":"Player Props";
  var gradeColor = edge.grade==="A"||edge.grade==="A-"?POS_C:edge.grade==="B+"?ACCENT:WARN_C;
  var posF = (edge.factors||[]).filter(function(f){return f.score>0;}).length;
  var negF = (edge.factors||[]).filter(function(f){return f.score<0;}).length;
  var neutralF = (edge.factors||[]).filter(function(f){return f.score===0;}).length;
  return (
    <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
      marginBottom:8,overflow:"hidden"}}>
      <div onClick={function(){setOpen(!open);}} style={{padding:"12px 14px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
            <span style={{fontSize:16,flexShrink:0}}>{edge.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:TEXT,overflow:"hidden",
              textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{edge.bet}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:900,color:gradeColor}}>{edge.grade}</div>
              <div style={{fontSize:8,color:MUTED}}>Grade</div>
            </div>
            <span style={{color:TEXT2,fontSize:11}}>{open?"▲":"▼"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
          {edge.team && <TeamBadge abbr={edge.team}/>}
          <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
            background:catColor+"22",border:"1px solid "+catColor+"44",color:catColor}}>
            📊 {catLabel}
          </span>
        </div>
        <ConfBar pct={edge.conf}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
          <span style={{fontSize:10,color:POS_C,fontWeight:600}}>
            {edge.supporting} supporting
          </span>
          <span style={{fontSize:10,color:MUTED,fontFamily:"'IBM Plex Mono',monospace"}}>
            {edge.line}
          </span>
        </div>
      </div>
      {open && (
        <div style={{borderTop:"1px solid "+BORDER}}>
          <div style={{display:"flex",borderBottom:"1px solid "+BORDER}}>
            {[["analysis","📋 Analysis"],["signals","📡 Signals"],["lines","📖 Lines"]].map(function(item) {
              var id = item[0]; var label = item[1];
              var isActive = section===id;
              return (
                <button key={id} onClick={function(e){e.stopPropagation();setSection(id);}}
                  style={{flex:1,padding:"8px 4px",fontSize:10,fontWeight:600,
                    cursor:"pointer",border:"none",
                    background:isActive?CARD2:"transparent",
                    color:isActive?TEXT:MUTED,
                    borderBottom:isActive?"2px solid "+catColor:"2px solid transparent",
                    transition:"all .15s"}}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{padding:"12px 14px"}}>
            {section==="analysis" && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10}}>🤖</span>
                    <span style={{fontSize:9,fontWeight:800,color:ACCENT,letterSpacing:".1em"}}>
                      EDGEVIEW ANALYSIS
                    </span>
                    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                      width:14,height:14,borderRadius:"50%",background:ACCENT+"22",
                      fontSize:8,color:ACCENT,cursor:"pointer"}}>i</span>
                  </div>
                  <div style={{padding:"4px 10px",borderRadius:8,background:POS_C+"18",
                    border:"1px solid "+POS_C+"33",fontSize:9,fontWeight:700,color:POS_C,
                    cursor:"pointer"}}>
                    📊 Full Stats
                  </div>
                </div>
                <div style={{fontSize:11,color:TEXT2,lineHeight:1.7,marginBottom:10}}>
                  {edge.analysis}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Sample Line</div>
                    <div style={{fontSize:11,fontWeight:800,color:ACCENT,
                      fontFamily:"'IBM Plex Mono',monospace"}}>{edge.line}</div>
                  </div>
                  <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Alt Play</div>
                    <div style={{fontSize:10,fontWeight:600,color:TEXT2,lineHeight:1.3}}>
                      {edge.altPlay}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:9,fontWeight:800,color:POS_C,
                  letterSpacing:".1em",marginBottom:8}}>SUPPORTING EVIDENCE</div>
                {edge.bullets.map(function(b, i) {
                  return (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:5}}>
                      <span style={{color:POS_C,fontSize:10,marginTop:1,flexShrink:0}}>•</span>
                      <span style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>{b}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {section==="signals" && (
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                  {[[POS_C,"For",posF],[MUTED,"Neutral",neutralF],[NEG_C,"Risk",negF]].map(function(item) {
                    var c=item[0]; var l=item[1]; var n=item[2];
                    return (
                      <div key={l} style={{textAlign:"center",padding:"8px 6px",
                        background:CARD3,borderRadius:10}}>
                        <div style={{fontSize:16,fontWeight:800,color:c}}>{n}</div>
                        <div style={{fontSize:9,color:MUTED}}>{l}</div>
                      </div>
                    );
                  })}
                </div>
                {(edge.factors||[]).map(function(f, i) {
                  return (<SignalCard key={i} f={f} onInfo={onInfo}/>);
                })}
              </div>
            )}
            {section==="lines" && (
              <div>
                <div style={{padding:"10px 12px",background:CARD3,borderRadius:10,marginBottom:8}}>
                  <div style={{fontSize:9,color:MUTED,marginBottom:4}}>Sample Line</div>
                  <div style={{fontSize:14,fontWeight:800,color:ACCENT,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{edge.line}</div>
                </div>
                {edge.altPlay && (
                  <div style={{padding:"10px 12px",background:CARD3,borderRadius:10}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:4}}>Alt Play</div>
                    <div style={{fontSize:12,fontWeight:700,color:TEXT2}}>{edge.altPlay}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PARLAY BUILDER ────────────────────────────────────────────────────────────
function ParlayBuilder() {
  var legsArr = useState(3);
  var legs = legsArr[0]; var setLegs = legsArr[1];
  var typesArr = useState(["ml","ou","f5","nrfi","tt","k","hit","hrbi"]);
  var activeTypes = typesArr[0]; var setActiveTypes = typesArr[1];

  function toggleType(id) {
    if(activeTypes.indexOf(id) > -1) {
      setActiveTypes(activeTypes.filter(function(t){return t!==id;}));
    } else {
      setActiveTypes(activeTypes.concat([id]));
    }
  }

  var combos = PARLAY_COMBOS[legs] || [];
  var riskMsg = legs===5?"5-leg parlays are extremely high risk — small stakes only.":
                legs===4?"4-leg parlays are high risk — recommended for small stakes.":
                legs===3?"3-leg parlays carry moderate risk — size accordingly.":"";

  return (
    <div>
      <div style={{background:AGL,border:"1px solid rgba(77,159,255,.2)",
        borderRadius:12,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:ACCENT,marginBottom:4}}>
          🏦 Parlay Builder
        </div>
        <div style={{fontSize:11,color:TEXT2,lineHeight:1.5,marginBottom:8}}>
          EdgeView assembles the best parlay combinations from tonight's highest-confidence edges.
        </div>
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
          width:20,height:20,borderRadius:"50%",background:ACCENT+"22",
          border:"1px solid "+ACCENT+"44",fontSize:10,color:ACCENT,cursor:"pointer"}}>
          i
        </div>
      </div>
      <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",marginBottom:8}}>
        NUMBER OF LEGS
      </div>
      <div style={{display:"flex",gap:8,marginBottom:6}}>
        {[2,3,4,5].map(function(n) {
          var isActive = legs===n;
          var icon = n===4?"🔥":n===5?"💎":"";
          return (
            <button key={n} onClick={function(){setLegs(n);}}
              style={{flex:1,padding:"10px 4px",borderRadius:14,fontSize:12,fontWeight:700,
                cursor:"pointer",border:"2px solid "+(isActive?ACCENT:BORDER),
                background:isActive?ACCENT+"22":"transparent",
                color:isActive?ACCENT:TEXT2}}>
              {n}-Leg {icon}
            </button>
          );
        })}
      </div>
      {riskMsg && (
        <div style={{fontSize:10,color:WARN_C,marginBottom:12,
          display:"flex",alignItems:"center",gap:4}}>
          <span>⚠</span> {riskMsg}
        </div>
      )}
      <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",marginBottom:8}}>
        BET TYPES TO INCLUDE
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {BET_TYPE_OPTS.map(function(bt) {
          var isActive = activeTypes.indexOf(bt.id) > -1;
          return (
            <button key={bt.id} onClick={function(){toggleType(bt.id);}}
              style={{padding:"5px 10px",borderRadius:20,fontSize:10,fontWeight:600,
                cursor:"pointer",display:"flex",alignItems:"center",gap:4,
                background:isActive?ACCENT+"22":"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?ACCENT:TEXT2}}>
              <span style={{fontSize:11}}>{bt.icon}</span>
              {bt.label}
            </button>
          );
        })}
      </div>
      {combos.length > 0 ? combos.map(function(combo, i) {
        var isTop = i===0;
        return (
          <div key={i} style={{background:isTop?CARD2:CARD,
            border:"1px solid "+(isTop?WARN_C+"44":BORDER),
            borderRadius:14,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {isTop && <span style={{fontSize:12}}>🏆</span>}
                <span style={{fontSize:12,fontWeight:800,color:isTop?WARN_C:TEXT}}>
                  {combo.label}
                </span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:900,color:ACCENT,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{combo.odds}</div>
                <div style={{fontSize:9,color:MUTED}}>Est. odds</div>
              </div>
            </div>
            <div style={{fontSize:9,color:MUTED,marginBottom:10}}>
              {legs}-leg · {combo.prob}% combined probability
            </div>
            {combo.legs.map(function(leg, j) {
              var edge = FULL_EDGES.find(function(e){
                return e.bet.indexOf(leg)>-1 || leg.indexOf(e.bet)>-1;
              }) || {type:"side",conf:90,grade:"A"};
              var catColor = edge.type==="total"?ACCENT:edge.type==="props"?WARN_C:POS_C;
              var catLabel = edge.type==="total"?"Totals":edge.type==="props"?"Player Props":"Game Lines";
              return (
                <div key={j} style={{background:CARD3,borderRadius:10,
                  padding:"10px 12px",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:TEXT}}>{leg}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,
                        background:catColor+"22",border:"1px solid "+catColor+"44",
                        color:catColor,fontWeight:700}}>
                        {catLabel}
                      </span>
                      <span style={{fontSize:9,color:POS_C,fontWeight:700}}>
                        {edge.conf}% {edge.grade}
                      </span>
                    </div>
                    <button style={{padding:"3px 8px",borderRadius:8,fontSize:9,
                      fontWeight:700,background:ACCENT+"22",
                      border:"1px solid "+ACCENT+"44",color:ACCENT,cursor:"pointer"}}>
                      📊 Stats
                    </button>
                  </div>
                  <ConfBar pct={edge.conf}/>
                </div>
              );
            })}
          </div>
        );
      }) : (
        <div style={{padding:"24px",background:CARD3,borderRadius:12,
          textAlign:"center",color:MUTED,fontSize:11}}>
          No qualifying combinations with current filters.
          Try adding more bet types or reducing to {legs-1} legs.
        </div>
      )}
      <div style={{padding:"12px 14px",background:"rgba(251,191,36,.08)",
        border:"1px solid rgba(251,191,36,.2)",borderRadius:10,marginTop:8}}>
        <div style={{fontSize:9,fontWeight:800,color:WARN_C,letterSpacing:".1em",marginBottom:4}}>
          PARLAY RISK WARNING
        </div>
        <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
          Parlays multiply risk. All legs must win. Only parlay 70%+ confidence legs
          with 2-leg combos for best results. Never bet more than you can afford to lose.
        </div>
      </div>
    </div>
  );
}

// ── GAME SUMMARY MODAL ────────────────────────────────────────────────────────
function GameSummaryModal(props) {
  var onClose = props.onClose;
  var statRows = [
    {good:true,  label:"Cole ERA / FIP / xFIP", val:"2.91 / 2.44 / 2.88", why:"All three metrics sub-3.00 — confirmed across every pitching measure."},
    {good:false, label:"Bello ERA / FIP / xFIP", val:"3.84 / 4.18 / 4.61", why:"Bello's xFIP is 0.77 runs worse than his ERA — regression is due."},
    {good:false, label:"BOS Road Offense",       val:"3.1 R/G last 9G",    why:"BOS averaging just 3.1 runs per game in their last 9 away starts."},
    {good:true,  label:"NYY Home Record",         val:"7-1 last 8G, 6.2 R/G", why:"NYY has been dominant at home, scoring 6.2 runs per game."},
    {good:true,  label:"H2H 2025",                val:"NYY 6-4, +17 run diff", why:"NYY outscoring BOS by 17 runs in head-to-head meetings."},
    {good:false, label:"BOS Bullpen Health",      val:"62/100",            why:"Martin and Winckowski both pitched yesterday. ERA 4.21 last 7 days."},
    {good:true,  label:"Umpire Zone",             val:"Tight -2.2%",       why:"Zone slightly tighter than average — mild K suppression expected."},
  ];
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,
      background:"rgba(0,0,0,.85)",backdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"90vh",overflowY:"auto",padding:"22px 18px 36px",
          animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"flex-start",
          justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:10}}>🤖</span>
              <span style={{fontSize:9,fontWeight:800,color:ACCENT,letterSpacing:".1em"}}>
                EDGEVIEW STATISTICAL SUMMARY
              </span>
            </div>
            <div style={{fontSize:15,fontWeight:900,color:TEXT,lineHeight:1.3}}>
              Tonight's Matchup — BOS @ NYY Statistical Summary
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,borderRadius:8,
              width:28,height:28,color:TEXT2,cursor:"pointer",fontSize:14,
              flexShrink:0,marginLeft:10}}>
            x
          </button>
        </div>
        <div style={{padding:"12px 14px",background:CARD3,borderRadius:12,
          marginBottom:16,border:"1px solid "+BORDER}}>
          <div style={{fontSize:12,color:TEXT2,lineHeight:1.7}}>
            This game has one of the cleanest analytical setups of the week.
            Cole vs Bello is an extreme mismatch in pitcher quality. Multiple
            independent factors — starter dominance, lineup vulnerability,
            bullpen advantage, umpire zone, wind, and H2H history — all converge
            on the same story: NYY wins quietly. The under is the most statistically
            supported outcome on the board tonight.
          </div>
        </div>
        <div style={{fontSize:9,fontWeight:800,color:MUTED,
          letterSpacing:".12em",marginBottom:10}}>STATISTICAL BACKING</div>
        {statRows.map(function(row, i) {
          var color = row.good ? POS_C : NEG_C;
          var bg = row.good ? "rgba(52,211,153,.06)" : "rgba(255,90,90,.06)";
          var border = row.good ? "rgba(52,211,153,.15)" : "rgba(255,90,90,.15)";
          return (
            <div key={i} style={{background:bg,border:"1px solid "+border,
              borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:color,fontWeight:800}}>
                    {row.good?"v":"x"}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,color:TEXT}}>
                    {row.label}
                  </span>
                </div>
                <span style={{fontSize:11,fontWeight:800,color:color,
                  fontFamily:"'IBM Plex Mono',monospace",flexShrink:0,marginLeft:8}}>
                  {row.val}
                </span>
              </div>
              <div style={{fontSize:10,color:TEXT2,lineHeight:1.4,paddingLeft:18}}>
                {row.why}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ANALYSIS TAB ──────────────────────────────────────────────────────────────
function AnalysisTab() {
  var filterArr = useState("All");
  var filter = filterArr[0]; var setFilter = filterArr[1];
  var showSummaryArr = useState(false);
  var showSummary = showSummaryArr[0]; var setShowSummary = showSummaryArr[1];
  var infoTermArr = useState(null);
  var infoTerm = infoTermArr[0]; var setInfoTerm = infoTermArr[1];

  var sideEdges = FULL_EDGES.filter(function(e){return e.type==="side";});
  var totalEdges = FULL_EDGES.filter(function(e){return e.type==="total";});
  var propEdges = FULL_EDGES.filter(function(e){return e.type==="props";});

  var filteredEdges = filter==="All" ? FULL_EDGES.slice(1) :
    filter==="Game Lines" ? sideEdges.slice(1) :
    filter==="Totals" ? totalEdges :
    filter==="Props" ? propEdges : [];

  var isParlays = filter==="Parlays";
  var topEdge = FULL_EDGES[0];

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      {showSummary && (
        <GameSummaryModal onClose={function(){setShowSummary(false);}}/>
      )}
      {infoTerm && (
        <GlossaryModal term={infoTerm} onClose={function(){setInfoTerm(null);}}/>
      )}

      <MatchupOverview onOpenSummary={function(){setShowSummary(true);}}/>

      <TopEdgeCard edge={topEdge}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[
          {label:"Game Lines",n:sideEdges.length,pct:100},
          {label:"Totals",n:totalEdges.length,pct:94},
          {label:"Props",n:propEdges.length,pct:100},
        ].map(function(box) {
          return (
            <div key={box.label} style={{background:CARD3,borderRadius:12,
              padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:TEXT}}>{box.n}</div>
              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{box.label}</div>
              <ConfBar pct={box.pct}/>
              <div style={{fontSize:9,color:POS_C,marginTop:2,fontWeight:700}}>
                {box.pct}%
              </div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:8,paddingBottom:4}}>
        {["All","Game Lines","Totals","Props","Parlays"].map(function(f) {
          var isActive = filter===f;
          return (
            <button key={f} onClick={function(){setFilter(f);}}
              style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {f==="Parlays"?"🏦 Parlays":f}
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["Confidence","🎯"],["Grade","📊"]].map(function(item) {
          return (
            <button key={item[0]}
              style={{padding:"4px 10px",borderRadius:14,fontSize:10,fontWeight:600,
                cursor:"pointer",background:"transparent",
                border:"1px solid "+BORDER,color:TEXT2,
                display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:9}}>{item[1]}</span> {item[0]}
            </button>
          );
        })}
      </div>

      {isParlays ? (
        <ParlayBuilder/>
      ) : (
        <div>
          {filteredEdges.map(function(edge, i) {
            return (
              <FullEdgeCard key={edge.id} edge={edge} idx={i}
                onInfo={function(f){setInfoTerm(f.label);}}/>
            );
          })}
          <div style={{padding:"12px 14px",background:"rgba(251,191,36,.06)",
            border:"1px solid rgba(251,191,36,.15)",borderRadius:10,marginTop:8}}>
            <div style={{fontSize:9,fontWeight:800,color:WARN_C,
              letterSpacing:".1em",marginBottom:4}}>DISCLAIMER</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              EdgeView's engine uses statistical rules and historical patterns.
              NOT financial advice. Always verify odds and gamble responsibly.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function TrendsTab() {
  var tagArr = useState("All");
  var activeTag = tagArr[0];
  var setActiveTag = tagArr[1];
  var tags = ["All","Form","Pitching","Bullpen","Ballpark","Lineup","H2H","Umpire","Betting"];
  var filtered = activeTag==="All" ? TRENDS_DATA :
    TRENDS_DATA.filter(function(t){return t.cat===activeTag;});
  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
        {tags.map(function(tag) {
          var isActive = activeTag===tag;
          return (
            <button key={tag} onClick={function(){setActiveTag(tag);}}
              style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {tag}
            </button>
          );
        })}
      </div>
      {filtered.map(function(trend) {
        var tc = TEAM_C[trend.team] || ACCENT;
        return (
          <div key={trend.id} style={{background:trend.hot?"rgba(255,107,43,.08)":"rgba(125,212,252,.05)",
            border:"1px solid "+(trend.hot?"rgba(255,107,43,.2)":"rgba(125,212,252,.15)"),
            borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{fontSize:18,flexShrink:0}}>{trend.hot?"🔥":"❄️"}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,fontWeight:700,color:TEXT}}>{trend.title}</span>
                  {trend.team && <TeamBadge abbr={trend.team}/>}
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
                    background:CARD3,border:"1px solid "+BORDER,color:MUTED}}>
                    {trend.cat}
                  </span>
                </div>
                <div style={{fontSize:11,color:TEXT2,lineHeight:1.6}}>{trend.body}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BetTile(props) {
  var rec = props.rec; var pct = props.pct; var label = props.label;
  var color = pct>=60 ? POS_C : pct<=40 ? NEG_C : TEXT2;
  var bg  = pct>=60 ? "rgba(52,211,153,.07)" : pct<=40 ? "rgba(255,90,90,.07)" : "rgba(255,255,255,.03)";
  var bdr = pct>=60 ? "rgba(52,211,153,.2)"  : pct<=40 ? "rgba(255,90,90,.2)"  : BORDER;
  return (
    <div style={{background:bg,border:"1px solid "+bdr,borderRadius:10,
      padding:"10px 8px",textAlign:"center"}}>
      <div style={{fontSize:14,fontWeight:900,color:color,
        fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{rec}</div>
      <div style={{height:2,background:BORDER2,borderRadius:1,overflow:"hidden",marginBottom:4}}>
        <div style={{height:"100%",width:pct+"%",background:color,borderRadius:1}}/>
      </div>
      <div style={{fontSize:11,fontWeight:700,color:color,marginBottom:3}}>{pct}%</div>
      <div style={{fontSize:8,color:MUTED,lineHeight:1.3}}>{label}</div>
    </div>
  );
}


// ── SUMMARY TAB ───────────────────────────────────────────────────────────────
function SummaryTab() {
  var viewArr = useState("Game Stats");
  var view = viewArr[0];
  var setView = viewArr[1];
  var splitArr = useState("5G");
  var split = splitArr[0];
  var setSplit = splitArr[1];
  var expandArr = useState(null);
  var expand = expandArr[0];
  var setExpand = expandArr[1];
  var sd = SUMMARY_DATA;
  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,fontWeight:isActive?700:500,
                cursor:"pointer",border:"none",
                background:isActive?ACCENT:isActive?"#fbbf24":"transparent",
                color:isActive?"#fff":MUTED}}>
              {v}
            </button>
          );
        })}
      </div>
      {view==="Betting Stats" && (
        <div>
          {[sd.away, sd.home].map(function(t) {
            var tc = TEAM_C[t.abbr] || ACCENT;
            return (
              <div key={t.abbr} style={{background:CARD,borderRadius:14,
                border:"2px solid "+(tc+"44"),marginBottom:14,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:26,height:26,borderRadius:8,background:tc+"22",
                      border:"1px solid "+tc+"44",display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:10,fontWeight:800,color:tc}}>
                      {t.abbr}
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:TEXT}}>
                      {t.abbr} Betting Record
                    </span>
                  </div>
                  <div style={{display:"flex",gap:3}}>
                    {t.form.map(function(r,i){
                      return (<div key={i} style={{width:7,height:7,borderRadius:"50%",
                        background:r==="W"?POS_C:r==="L"?NEG_C:WARN_C}}/>);
                    })}
                  </div>
                </div>
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>MONEY LINE / RUN LINE</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                    <BetTile rec={t.bml}  pct={t.bml_p}  label="Money Line"/>
                    <BetTile rec={t.brlm} pct={t.brlm_p} label="-1.5 Run Line"/>
                    <BetTile rec={t.brlp} pct={t.brlp_p} label="+1.5 Run Line"/>
                  </div>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>TOTALS</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                    <BetTile rec={t.bover}  pct={t.bover_p}  label="Over"/>
                    <BetTile rec={t.bunder} pct={t.bunder_p} label="Under"/>
                    <BetTile rec={t.bnrfi}  pct={t.bnrfi_p}  label="NRFI"/>
                  </div>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>FIRST 5 INNINGS</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
                    <BetTile rec={t.bf5ml} pct={t.bf5ml_p} label="F5 Money Line"/>
                    <BetTile rec={t.bf5u}  pct={t.bf5u_p}  label="F5 Under"/>
                  </div>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>TEAM TOTALS / ATS SPLITS</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                    <BetTile rec={t.bttover}  pct={t.bttover_p}  label="TT Over"/>
                    <BetTile rec={t.bttunder} pct={t.bttunder_p} label="TT Under"/>
                    <BetTile rec={t.batsH}    pct={t.batsH_p}    label="ATS Home"/>
                    <BetTile rec={t.batsA}    pct={t.batsA_p}    label="ATS Away"/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto"}}>
        {["5G","10G","15G","30G","Full Season"].map(function(s) {
          var isActive = split===s;
          return (
            <button key={s} onClick={function(){setSplit(s);}}
              style={{padding:"4px 10px",borderRadius:14,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {s}
            </button>
          );
        })}
      </div>
      {[sd.away, sd.home].map(function(team) {
        var isExpanded = expand===team.abbr;
        var formColors = team.form.map(function(r){return r==="W"?POS_C:r==="L"?NEG_C:WARN_C;});
        return (
          <div key={team.abbr} style={{background:CARD,borderRadius:14,
            border:"1px solid "+(TEAM_C[team.abbr]||BORDER),
            marginBottom:12,overflow:"hidden"}}>
            <div style={{padding:"14px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontSize:12,color:MUTED}}>{team.abbr} — {team.abbr===sd.away.abbr?"Road":"Home"} Record</div>
                  <div style={{fontSize:10,color:MUTED}}>Last 5 games</div>
                </div>
                <div style={{display:"flex",gap:3}}>
                  {formColors.map(function(c, i) {
                    return (<div key={i} style={{width:8,height:8,borderRadius:"50%",background:c}}/>);
                  })}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:12}}>
                <span style={{fontSize:36,fontWeight:900,color:POS_C,
                  fontFamily:"'IBM Plex Mono',monospace"}}>
                  {team.record}
                </span>
                <span style={{fontSize:14,fontWeight:600,color:TEXT2}}>
                  {team.winPct}% win rate
                </span>
              </div>
              {view==="Game Stats" && (
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>OFFENSE</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
                    {[
                      {l:"Runs/G",v:team.avgRG},
                      {l:"AVG",v:team.offenseAvg},
                      {l:"OBP",v:team.offenseOBP},
                      {l:"OPS",v:team.offenseOPS},
                    ].map(function(stat) {
                      return (
                        <div key={stat.l} style={{background:CARD3,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                          <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{stat.v}</div>
                          <div style={{fontSize:8,color:MUTED,marginTop:2}}>{stat.l}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{fontSize:9,fontWeight:700,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>DEFENSE (OPP. ALLOWED)</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                    {[
                      {l:"Allow/G",v:team.allowRG},
                      {l:"Opp AVG",v:team.defenseAvg},
                      {l:"Opp OBP",v:team.defenseOBP},
                      {l:"Opp OPS",v:team.defenseOPS},
                    ].map(function(stat) {
                      return (
                        <div key={stat.l} style={{background:CARD3,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                          <div style={{fontSize:13,fontWeight:700,color:TEXT2}}>{stat.v}</div>
                          <div style={{fontSize:8,color:MUTED,marginTop:2}}>{stat.l}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                            <div onClick={function(){setExpand(isExpanded?null:team.abbr);}}
                style={{textAlign:"center",marginTop:10,fontSize:10,color:ACCENT,
                  fontWeight:600,cursor:"pointer"}}>
                {isExpanded?"Hide":"Show"} Last 5 Games {isExpanded?"▲":"▼"}
              </div>
              {isExpanded && (
                <div style={{marginTop:10,overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                    <thead>
                      <tr style={{color:MUTED,fontWeight:700}}>
                        {["DATE","OPP","W/L","VENUE","RS","RA","SP","ATS","O/U"].map(function(h) {
                          return (<th key={h} style={{padding:"4px 6px",textAlign:"left"}}>{h}</th>);
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {team.log.map(function(g, i) {
                        return (
                          <tr key={i} style={{borderTop:"1px solid "+BORDER}}>
                            <td style={{padding:"5px 6px",color:TEXT2}}>{g.date}</td>
                            <td style={{padding:"5px 6px",color:TEXT2}}>{g.opp}</td>
                            <td style={{padding:"5px 6px",color:g.wl==="W"?POS_C:NEG_C,fontWeight:700}}>{g.wl}</td>
                            <td style={{padding:"5px 6px",color:TEXT2}}>{g.venue}</td>
                            <td style={{padding:"5px 6px",color:TEXT,fontWeight:600}}>{g.rs}</td>
                            <td style={{padding:"5px 6px",color:TEXT,fontWeight:600}}>{g.ra}</td>
                            <td style={{padding:"5px 6px",color:TEXT2}}>{g.sp}</td>
                            <td style={{padding:"5px 6px",color:g.ats==="W"?POS_C:g.ats==="L"?NEG_C:MUTED,fontWeight:700}}>{g.ats}</td>
                            <td style={{padding:"5px 6px",color:g.ou==="O"?WARN_C:g.ou==="U"?ACCENT:MUTED,fontWeight:700}}>{g.ou}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── BATTING TAB ───────────────────────────────────────────────────────────────
// ── BATTING DATA ──────────────────────────────────────────────────────────────
var BATTING_LINEUPS = {
  BOS:[
    {name:"Yoshida, M.", pos:"LF", bats:"L", hot:true, cold:false,
     std:{avg:".278",obp:".348",slg:".429",ops:".777",pa:312},
     adv:{woba:".338",wrc:108,xba:".261",xslg:".412",hard:38.2,barrel:6.1},
     splits:{vslAvg:".301",vslOps:".841",vsrAvg:".264",vsrOps:".741",homeOps:".831",awayOps:".711"},
     hotcold:{l7avg:".318",l7hr:2,l7rbi:6,l14avg:".292",l14hr:4},
     sit:{robAvg:".298",robOps:".812",riscAvg:".311",riscOps:".844"},
     note:"Contact-first LHH. .311 AVG vs RHP in 2024."},
    {name:"Devers, R.",  pos:"3B", bats:"L", hot:true, cold:false,
     std:{avg:".281",obp:".341",slg:".521",ops:".862",pa:298},
     adv:{woba:".361",wrc:128,xba:".264",xslg:".512",hard:48.1,barrel:9.8},
     splits:{vslAvg:".298",vslOps:".912",vsrAvg:".256",vsrOps:".788",homeOps:".871",awayOps:".788"},
     hotcold:{l7avg:".341",l7hr:3,l7rbi:9,l14avg:".308",l14hr:5},
     sit:{robAvg:".284",robOps:".864",riscAvg:".278",riscOps:".841"},
     note:"Elite power LHH. 2 HR in 16 AB vs Cole career."},
    {name:"Casas, T.",   pos:"1B", bats:"L", hot:false, cold:false,
     std:{avg:".242",obp:".341",slg:".428",ops:".769",pa:278},
     adv:{woba:".338",wrc:112,xba:".251",xslg:".428",hard:41.2,barrel:7.4},
     splits:{vslAvg:".264",vslOps:".814",vsrAvg:".228",vsrOps:".714",homeOps:".791",awayOps:".704"},
     hotcold:{l7avg:".214",l7hr:1,l7rbi:4,l14avg:".228",l14hr:2},
     sit:{robAvg:".258",robOps:".784",riscAvg:".241",riscOps:".761"},
     note:"Patient hitter. High walk rate reduces K exposure."},
    {name:"O'Neill, T.", pos:"RF", bats:"R", hot:false, cold:true,
     std:{avg:".241",obp:".301",slg:".418",ops:".719",pa:241},
     adv:{woba:".318",wrc:98,xba:".234",xslg:".441",hard:44.8,barrel:8.1},
     splits:{vslAvg:".198",vslOps:".641",vsrAvg:".244",vsrOps:".754",homeOps:".748",awayOps:".678"},
     hotcold:{l7avg:".148",l7hr:1,l7rbi:3,l14avg:".188",l14hr:2},
     sit:{robAvg:".241",robOps:".741",riscAvg:".218",riscOps:".701"},
     note:"High K risk vs elite RHP. 28.4% K rate last 14D."},
    {name:"Duvall, A.",  pos:"LF", bats:"R", hot:false, cold:true,
     std:{avg:".228",obp:".281",slg:".418",ops:".699",pa:228},
     adv:{woba:".301",wrc:88,xba:".221",xslg:".411",hard:42.8,barrel:7.2},
     splits:{vslAvg:".244",vslOps:".748",vsrAvg:".198",vsrOps:".634",homeOps:".701",awayOps:".634"},
     hotcold:{l7avg:".176",l7hr:1,l7rbi:3,l14avg:".194",l14hr:2},
     sit:{robAvg:".228",robOps:".694",riscAvg:".214",riscOps:".671"},
     note:"Power over contact. Struggles vs high-K RHP."},
    {name:"Valdez, E.",  pos:"SS", bats:"S", hot:false, cold:true,
     std:{avg:".251",obp:".308",slg:".348",ops:".656",pa:212},
     adv:{woba:".298",wrc:84,xba:".241",xslg:".358",hard:34.8,barrel:4.1},
     splits:{vslAvg:".271",vslOps:".728",vsrAvg:".234",vsrOps:".648",homeOps:".711",awayOps:".641"},
     hotcold:{l7avg:".194",l7hr:0,l7rbi:2,l14avg:".218",l14hr:1},
     sit:{robAvg:".261",robOps:".704",riscAvg:".248",riscOps:".694"},
     note:"Switch hitter. Platoon splits favor vs LHP."},
    {name:"Wong, C.",    pos:"2B", bats:"L", hot:false, cold:false,
     std:{avg:".248",obp:".311",slg:".338",ops:".649",pa:198},
     adv:{woba:".294",wrc:84,xba:".228",xslg:".338",hard:32.1,barrel:3.8},
     splits:{vslAvg:".258",vslOps:".701",vsrAvg:".221",vsrOps:".611",homeOps:".671",awayOps:".611"},
     hotcold:{l7avg:".222",l7hr:0,l7rbi:2,l14avg:".228",l14hr:1},
     sit:{robAvg:".248",robOps:".671",riscAvg:".234",riscOps:".651"},
     note:"Below-average bat. Defensive specialist role."},
    {name:"Hamilton, D.",pos:"CF", bats:"R", hot:true, cold:false,
     std:{avg:".264",obp:".321",slg:".394",ops:".715",pa:184},
     adv:{woba:".314",wrc:96,xba:".254",xslg:".371",hard:31.4,barrel:4.2},
     splits:{vslAvg:".284",vslOps:".748",vsrAvg:".248",vsrOps:".661",homeOps:".724",awayOps:".664"},
     hotcold:{l7avg:".318",l7hr:1,l7rbi:4,l14avg:".294",l14hr:2},
     sit:{robAvg:".278",robOps:".728",riscAvg:".284",riscOps:".741"},
     note:"Speed-first CF. .318 last 7G — hot streak active."},
    {name:"Mayer, M.",   pos:"SS", bats:"R", hot:false, cold:false,
     std:{avg:".241",obp:".298",slg:".368",ops:".666",pa:162},
     adv:{woba:".298",wrc:86,xba:".231",xslg:".348",hard:33.8,barrel:3.9},
     splits:{vslAvg:".261",vslOps:".714",vsrAvg:".224",vsrOps:".624",homeOps:".681",awayOps:".631"},
     hotcold:{l7avg:".211",l7hr:0,l7rbi:2,l14avg:".224",l14hr:1},
     sit:{robAvg:".251",robOps:".681",riscAvg:".244",riscOps:".668"},
     note:"Rookie. Limited track record vs elite arms."},
  ],
  NYY:[
    {name:"Judge, A.",   pos:"RF", bats:"R", hot:true, cold:false,
     std:{avg:".298",obp:".401",slg:".594",ops:".995",pa:318},
     adv:{woba:".421",wrc:182,xba:".281",xslg:".571",hard:52.4,barrel:14.8},
     splits:{vslAvg:".341",vslOps:"1.084",vsrAvg:".278",vsrOps:".941",homeOps:"1.021",awayOps:".948"},
     hotcold:{l7avg:".348",l7hr:3,l7rbi:8,l14avg:".318",l14hr:5},
     sit:{robAvg:".311",robOps:"1.014",riscAvg:".334",riscOps:"1.084"},
     note:"MVP-caliber. 3 HR last 5G. Elite vs all pitch types."},
    {name:"Soto, J.",    pos:"LF", bats:"L", hot:true, cold:false,
     std:{avg:".312",obp:".421",slg:".541",ops:".962",pa:308},
     adv:{woba:".412",wrc:174,xba:".298",xslg:".524",hard:44.1,barrel:11.2},
     splits:{vslAvg:".338",vslOps:".984",vsrAvg:".294",vsrOps:".924",homeOps:".984",awayOps:".934"},
     hotcold:{l7avg:".412",l7hr:2,l7rbi:7,l14avg:".388",l14hr:3},
     sit:{robAvg:".328",robOps:".994",riscAvg:".318",riscOps:".974"},
     note:"Elite OBP machine. .412 BA last 14D vs BOS."},
    {name:"Stanton, G.", pos:"DH", bats:"R", hot:false, cold:false,
     std:{avg:".241",obp:".318",slg:".518",ops:".836",pa:284},
     adv:{woba:".358",wrc:132,xba:".251",xslg:".508",hard:54.8,barrel:13.1},
     splits:{vslAvg:".264",vslOps:".888",vsrAvg:".228",vsrOps:".804",homeOps:".864",awayOps:".804"},
     hotcold:{l7avg:".241",l7hr:2,l7rbi:5,l14avg:".258",l14hr:3},
     sit:{robAvg:".251",robOps:".848",riscAvg:".244",riscOps:".828"},
     note:"Raw power. High K rate (32%) but elite damage when contact."},
    {name:"Rizzo, A.",   pos:"1B", bats:"L", hot:false, cold:false,
     std:{avg:".218",obp:".311",slg:".381",ops:".692",pa:264},
     adv:{woba:".308",wrc:94,xba:".228",xslg:".378",hard:38.4,barrel:6.8},
     splits:{vslAvg:".241",vslOps:".754",vsrAvg:".208",vsrOps:".661",homeOps:".714",awayOps:".664"},
     hotcold:{l7avg:".222",l7hr:0,l7rbi:3,l14avg:".231",l14hr:1},
     sit:{robAvg:".228",robOps:".701",riscAvg:".241",riscOps:".731"},
     note:"Veteran presence. Below-average year vs RHP."},
    {name:"Torres, G.",  pos:"2B", bats:"R", hot:false, cold:false,
     std:{avg:".258",obp:".318",slg:".418",ops:".736",pa:251},
     adv:{woba:".321",wrc:104,xba:".248",xslg:".408",hard:38.8,barrel:7.1},
     splits:{vslAvg:".278",vslOps:".784",vsrAvg:".244",vsrOps:".714",homeOps:".748",awayOps:".718"},
     hotcold:{l7avg:".264",l7hr:1,l7rbi:3,l14avg:".248",l14hr:2},
     sit:{robAvg:".268",robOps:".748",riscAvg:".251",riscOps:".721"},
     note:"Solid all-around 2B. Consistent vs both hands."},
    {name:"Volpe, A.",   pos:"SS", bats:"R", hot:false, cold:false,
     std:{avg:".248",obp:".308",slg:".398",ops:".706",pa:241},
     adv:{woba:".311",wrc:96,xba:".238",xslg:".388",hard:36.4,barrel:6.2},
     splits:{vslAvg:".264",vslOps:".741",vsrAvg:".238",vsrOps:".688",homeOps:".718",awayOps:".694"},
     hotcold:{l7avg:".258",l7hr:0,l7rbi:2,l14avg:".244",l14hr:1},
     sit:{robAvg:".258",robOps:".714",riscAvg:".241",riscOps:".694"},
     note:"Second-year breakout. Improving K rate (22% down from 28%)."},
    {name:"Trevino, J.", pos:"C",  bats:"R", hot:false, cold:false,
     std:{avg:".228",obp:".278",slg:".348",ops:".626",pa:184},
     adv:{woba:".288",wrc:78,xba:".218",xslg:".338",hard:31.8,barrel:4.1},
     splits:{vslAvg:".241",vslOps:".668",vsrAvg:".221",vsrOps:".601",homeOps:".641",awayOps:".611"},
     hotcold:{l7avg:".211",l7hr:0,l7rbi:2,l14avg:".218",l14hr:0},
     sit:{robAvg:".221",robOps:".638",riscAvg:".208",riscOps:".614"},
     note:"Defense-first catcher. Below-average bat expected."},
    {name:"LeMahieu, D.",pos:"3B", bats:"R", hot:false, cold:false,
     std:{avg:".241",obp:".298",slg:".341",ops:".639",pa:168},
     adv:{woba:".291",wrc:84,xba:".231",xslg:".331",hard:29.4,barrel:3.1},
     splits:{vslAvg:".258",vslOps:".688",vsrAvg:".228",vsrOps:".614",homeOps:".651",awayOps:".624"},
     hotcold:{l7avg:".222",l7hr:0,l7rbi:1,l14avg:".231",l14hr:0},
     sit:{robAvg:".241",robOps:".648",riscAvg:".224",riscOps:".631"},
     note:"Veteran utility. Contact-first approach, fading power."},
    {name:"Judge, A.",   pos:"RF", bats:"R", hot:true, cold:false,
     std:{avg:".298",obp:".401",slg:".594",ops:".995",pa:318},
     adv:{woba:".421",wrc:182,xba:".281",xslg:".571",hard:52.4,barrel:14.8},
     splits:{vslAvg:".341",vslOps:"1.084",vsrAvg:".278",vsrOps:".941",homeOps:"1.021",awayOps:".948"},
     hotcold:{l7avg:".348",l7hr:3,l7rbi:8,l14avg:".318",l14hr:5},
     sit:{robAvg:".311",robOps:"1.014",riscAvg:".334",riscOps:"1.084"},
     note:"(see above)"},
  ],
};

// ── BATTING TAB ───────────────────────────────────────────────────────────────

// ── PROP BETTING DATA ─────────────────────────────────────────────────────────
var PROP_CATS = ["1+Hits","1.5+TB","H+R+RBI","0.5+BB","RunScored","HR"];
var PROP_LABELS = {
  "1+Hits":"🎯 1+ Hits","1.5+TB":"📐 1.5+ TB","H+R+RBI":"📊 H+R+RBI",
  "0.5+BB":"🚶 0.5+ BB","RunScored":"🏃 Run Scored","HR":"💣 HR",
};
var PROP_DATA = {
  BOS:[
    {label:"Hot",  targets:"🔥 .318 avg last 7G · 🎯 5G hit streak",
     rec:{"1+Hits":"20-8","1.5+TB":"14-14","H+R+RBI":"18-10","0.5+BB":"22-6","RunScored":"18-10","HR":"8-20"},
     pct:{"1+Hits":71,"1.5+TB":50,"H+R+RBI":64,"0.5+BB":79,"RunScored":64,"HR":29},
     str:{"1+Hits":"5W","1.5+TB":"2W","H+R+RBI":"4W","0.5+BB":"3W","RunScored":"2W","HR":"3L"}},
    {label:"Hot",  targets:"🔥 .341 avg last 7G · 💥 48.1% hard hit · 🎯 4G streak",
     rec:{"1+Hits":"19-9","1.5+TB":"16-12","H+R+RBI":"17-11","0.5+BB":"18-10","RunScored":"16-12","HR":"10-18"},
     pct:{"1+Hits":68,"1.5+TB":57,"H+R+RBI":61,"0.5+BB":64,"RunScored":57,"HR":36},
     str:{"1+Hits":"4W","1.5+TB":"3W","H+R+RBI":"3W","0.5+BB":"2W","RunScored":"1W","HR":"2L"}},
    {label:"Avg",  targets:"— Patient hitter. BB rate elite but AVG suppressed vs RHP",
     rec:{"1+Hits":"16-12","1.5+TB":"13-15","H+R+RBI":"15-13","0.5+BB":"20-8","RunScored":"14-14","HR":"6-22"},
     pct:{"1+Hits":57,"1.5+TB":46,"H+R+RBI":54,"0.5+BB":71,"RunScored":50,"HR":21},
     str:{"1+Hits":"1W","1.5+TB":"2L","H+R+RBI":"1W","0.5+BB":"3W","RunScored":"1L","HR":"4L"}},
    {label:"Cold", targets:"❄️ .148 avg last 7G — avoid all O'Neill props tonight",
     rec:{"1+Hits":"14-14","1.5+TB":"11-17","H+R+RBI":"12-16","0.5+BB":"10-18","RunScored":"13-15","HR":"8-20"},
     pct:{"1+Hits":50,"1.5+TB":39,"H+R+RBI":43,"0.5+BB":36,"RunScored":46,"HR":29},
     str:{"1+Hits":"2L","1.5+TB":"3L","H+R+RBI":"2L","0.5+BB":"4L","RunScored":"2L","HR":"2L"}},
    {label:"Cold", targets:"❄️ .176 avg last 7G — cold across all categories",
     rec:{"1+Hits":"13-15","1.5+TB":"10-18","H+R+RBI":"11-17","0.5+BB":"8-20","RunScored":"12-16","HR":"9-19"},
     pct:{"1+Hits":46,"1.5+TB":36,"H+R+RBI":39,"0.5+BB":29,"RunScored":43,"HR":32},
     str:{"1+Hits":"3L","1.5+TB":"4L","H+R+RBI":"3L","0.5+BB":"5L","RunScored":"2L","HR":"1L"}},
    {label:"Cold", targets:"❄️ .194 avg last 7G — below average across props",
     rec:{"1+Hits":"15-13","1.5+TB":"12-16","H+R+RBI":"13-15","0.5+BB":"14-14","RunScored":"12-16","HR":"4-24"},
     pct:{"1+Hits":54,"1.5+TB":43,"H+R+RBI":46,"0.5+BB":50,"RunScored":43,"HR":14},
     str:{"1+Hits":"2W","1.5+TB":"2L","H+R+RBI":"1L","0.5+BB":"1W","RunScored":"2L","HR":"5L"}},
    {label:"Avg",  targets:"— Neutral across props. No strong lean tonight",
     rec:{"1+Hits":"14-14","1.5+TB":"10-18","H+R+RBI":"12-16","0.5+BB":"12-16","RunScored":"11-17","HR":"3-25"},
     pct:{"1+Hits":50,"1.5+TB":36,"H+R+RBI":43,"0.5+BB":43,"RunScored":39,"HR":11},
     str:{"1+Hits":"1L","1.5+TB":"2L","H+R+RBI":"1L","0.5+BB":"2L","RunScored":"1W","HR":"6L"}},
    {label:"Hot",  targets:"🔥 .318 last 7G — hit streak active, good run scored value",
     rec:{"1+Hits":"16-12","1.5+TB":"12-16","H+R+RBI":"14-14","0.5+BB":"13-15","RunScored":"15-13","HR":"5-23"},
     pct:{"1+Hits":57,"1.5+TB":43,"H+R+RBI":50,"0.5+BB":46,"RunScored":54,"HR":18},
     str:{"1+Hits":"3W","1.5+TB":"1W","H+R+RBI":"2W","0.5+BB":"1L","RunScored":"3W","HR":"3L"}},
    {label:"Avg",  targets:"— Rookie. Limited sample. No strong prop lean",
     rec:{"1+Hits":"14-14","1.5+TB":"10-18","H+R+RBI":"11-17","0.5+BB":"10-18","RunScored":"11-17","HR":"3-25"},
     pct:{"1+Hits":50,"1.5+TB":36,"H+R+RBI":39,"0.5+BB":36,"RunScored":39,"HR":11},
     str:{"1+Hits":"2L","1.5+TB":"1L","H+R+RBI":"2L","0.5+BB":"2L","RunScored":"1L","HR":"5L"}},
  ],
  NYY:[
    {label:"Hot",  targets:"🔥 .348 last 7G · 3 HR last 5G · Elite across all props",
     rec:{"1+Hits":"21-7","1.5+TB":"18-10","H+R+RBI":"20-8","0.5+BB":"22-6","RunScored":"19-9","HR":"12-16"},
     pct:{"1+Hits":75,"1.5+TB":64,"H+R+RBI":71,"0.5+BB":79,"RunScored":68,"HR":43},
     str:{"1+Hits":"5W","1.5+TB":"4W","H+R+RBI":"4W","0.5+BB":"5W","RunScored":"3W","HR":"3W"}},
    {label:"Hot",  targets:"🔥 .412 last 14D — hottest hitter in league. Back all Soto props",
     rec:{"1+Hits":"22-6","1.5+TB":"19-9","H+R+RBI":"20-8","0.5+BB":"23-5","RunScored":"20-8","HR":"11-17"},
     pct:{"1+Hits":79,"1.5+TB":68,"H+R+RBI":71,"0.5+BB":82,"RunScored":71,"HR":39},
     str:{"1+Hits":"6W","1.5+TB":"4W","H+R+RBI":"5W","0.5+BB":"6W","RunScored":"4W","HR":"2W"}},
    {label:"Avg",  targets:"— Average form. High HR upside but K rate a concern",
     rec:{"1+Hits":"14-14","1.5+TB":"13-15","H+R+RBI":"13-15","0.5+BB":"11-17","RunScored":"13-15","HR":"10-18"},
     pct:{"1+Hits":50,"1.5+TB":46,"H+R+RBI":46,"0.5+BB":39,"RunScored":46,"HR":36},
     str:{"1+Hits":"2W","1.5+TB":"1W","H+R+RBI":"1W","0.5+BB":"2L","RunScored":"1W","HR":"2W"}},
    {label:"Avg",  targets:"— Below-average year. Fade most Rizzo props tonight",
     rec:{"1+Hits":"13-15","1.5+TB":"10-18","H+R+RBI":"11-17","0.5+BB":"14-14","RunScored":"11-17","HR":"5-23"},
     pct:{"1+Hits":46,"1.5+TB":36,"H+R+RBI":39,"0.5+BB":50,"RunScored":39,"HR":18},
     str:{"1+Hits":"1L","1.5+TB":"2L","H+R+RBI":"2L","0.5+BB":"1W","RunScored":"2L","HR":"3L"}},
    {label:"Avg",  targets:"— Solid mid-tier. Hits are dependable vs most arms",
     rec:{"1+Hits":"15-13","1.5+TB":"12-16","H+R+RBI":"13-15","0.5+BB":"13-15","RunScored":"14-14","HR":"6-22"},
     pct:{"1+Hits":54,"1.5+TB":43,"H+R+RBI":46,"0.5+BB":46,"RunScored":50,"HR":21},
     str:{"1+Hits":"2W","1.5+TB":"1W","H+R+RBI":"1W","0.5+BB":"1L","RunScored":"2W","HR":"1W"}},
    {label:"Avg",  targets:"— Average form. Improving K rate is a positive sign",
     rec:{"1+Hits":"14-14","1.5+TB":"11-17","H+R+RBI":"12-16","0.5+BB":"12-16","RunScored":"13-15","HR":"5-23"},
     pct:{"1+Hits":50,"1.5+TB":39,"H+R+RBI":43,"0.5+BB":43,"RunScored":46,"HR":18},
     str:{"1+Hits":"1W","1.5+TB":"2L","H+R+RBI":"1L","0.5+BB":"1W","RunScored":"1W","HR":"2L"}},
    {label:"Cold", targets:"❄️ Defense-first catcher — fade all Trevino props",
     rec:{"1+Hits":"11-17","1.5+TB":"8-20","H+R+RBI":"9-19","0.5+BB":"9-19","RunScored":"10-18","HR":"3-25"},
     pct:{"1+Hits":39,"1.5+TB":29,"H+R+RBI":32,"0.5+BB":32,"RunScored":36,"HR":11},
     str:{"1+Hits":"2L","1.5+TB":"3L","H+R+RBI":"3L","0.5+BB":"3L","RunScored":"2L","HR":"5L"}},
    {label:"Avg",  targets:"— Fading power. No strong lean tonight",
     rec:{"1+Hits":"13-15","1.5+TB":"10-18","H+R+RBI":"11-17","0.5+BB":"12-16","RunScored":"11-17","HR":"4-24"},
     pct:{"1+Hits":46,"1.5+TB":36,"H+R+RBI":39,"0.5+BB":43,"RunScored":39,"HR":14},
     str:{"1+Hits":"1L","1.5+TB":"2L","H+R+RBI":"1L","0.5+BB":"1L","RunScored":"2L","HR":"4L"}},
    {label:"Hot",  targets:"🔥 .348 last 7G · 3 HR last 5G · Elite across all props",
     rec:{"1+Hits":"21-7","1.5+TB":"18-10","H+R+RBI":"20-8","0.5+BB":"22-6","RunScored":"19-9","HR":"12-16"},
     pct:{"1+Hits":75,"1.5+TB":64,"H+R+RBI":71,"0.5+BB":79,"RunScored":68,"HR":43},
     str:{"1+Hits":"5W","1.5+TB":"4W","H+R+RBI":"4W","0.5+BB":"5W","RunScored":"3W","HR":"3W"}},
  ],
};


function avgColor(val) {
  var n = parseFloat(val);
  if(n >= 0.300) return POS_C;
  if(n <= 0.200) return NEG_C;
  return TEXT2;
}
function opsColor(val) {
  var n = parseFloat(val);
  if(n >= 0.850) return POS_C;
  if(n <= 0.680) return NEG_C;
  return TEXT2;
}
function wrcColor(val) {
  if(val >= 130) return POS_C;
  if(val <= 85) return NEG_C;
  return TEXT2;
}
function hardColor(val) {
  if(val >= 46) return NEG_C;
  if(val >= 40) return WARN_C;
  return POS_C;
}

function HotIcon(sp) {
  var p = sp.p;
  if(p.hot) return (<span style={{fontSize:10,marginRight:3}}>🔥</span>);
  if(p.cold) return (<span style={{fontSize:10,marginRight:3}}>❄️</span>);
  return null;
}

function PlayerName(sp) {
  var p = sp.p;
  var color = p.hot ? HOT_C : p.cold ? COLD_C : TEXT;
  return (
    <div style={{display:"flex",alignItems:"center"}}>
      <HotIcon p={p}/>
      <span style={{fontSize:11,fontWeight:p.hot||p.cold?700:500,
        color:color,textDecoration:"underline",cursor:"pointer",
        textDecorationColor:color+"44"}}>
        {p.name}
      </span>
    </div>
  );
}


function BattingTab() {
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var teamArr = useState("BOS");
  var team = teamArr[0]; var setTeam = teamArr[1];
  var statViewArr = useState("Standard");
  var statView = statViewArr[0]; var setStatView = statViewArr[1];
  var filterArr = useState("All Teams / Season");
  var filter = filterArr[0]; var setFilter = filterArr[1];
  var activePropArr = useState("1+Hits");
  var activeProp = activePropArr[0]; var setActiveProp = activePropArr[1];

  var awayAbbr = GAME_DATA.away.abbr;
  var homeAbbr = GAME_DATA.home.abbr;
  var sp = team===awayAbbr ? GAME_DATA.homeP.name : GAME_DATA.awayP.name;
  var spEra = team===awayAbbr ? GAME_DATA.homeP.era : GAME_DATA.awayP.era;
  var spHot = team===awayAbbr ? true : false;
  var lineup = BATTING_LINEUPS[team] || [];


  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,fontWeight:isActive?700:500,
                cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        {[awayAbbr,homeAbbr].map(function(abbr) {
          var isActive = team===abbr;
          var tc = TEAM_C[abbr] || ACCENT;
          return (
            <button key={abbr} onClick={function(){setTeam(abbr);}}
              style={{padding:"10px",borderRadius:12,fontSize:13,fontWeight:700,
                cursor:"pointer",border:"2px solid "+(isActive?tc:BORDER),
                background:isActive?tc+"22":"transparent",color:isActive?tc:TEXT2}}>
              ⚾ {abbr}
            </button>
          );
        })}
      </div>

      <div style={{padding:"8px 12px",background:CARD,borderRadius:10,
        border:"1px solid "+BORDER,marginBottom:10,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:TEXT2}}>
          ⚾ <span style={{color:TEXT,fontWeight:600}}>{team}</span>
          {" vs "}
          <span style={{color:ACCENT,fontWeight:700}}>{sp}</span>
          <span style={{color:MUTED}}> ({spEra} ERA · {spHot?"🔥":"❄️"} RHP)</span>
        </span>
        <span style={{fontSize:10,color:ACCENT,fontWeight:600}}>{filter}</span>
      </div>

      {view==="Betting Stats" && (
        <div>
          <div style={{background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.2)",
            borderRadius:14,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:POS_C,letterSpacing:".1em",marginBottom:8}}>
              🎯 BEST PROP TARGETS TONIGHT — {team}
            </div>
            {(PROP_DATA[team]||[]).map(function(pd, i) {
              if(pd.label !== "Hot") return null;
              var p = (BATTING_LINEUPS[team]||[])[i];
              if(!p) return null;
              return (
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:6}}>
                  <span style={{color:POS_C,fontSize:11,flexShrink:0}}>•</span>
                  <div style={{fontSize:11,color:TEXT2,lineHeight:1.5}}>
                    <span style={{color:TEXT,fontWeight:700}}>{p.name}</span>
                    {" — "}{pd.targets}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:TEXT2,lineHeight:1.5,padding:"10px 12px",
            background:CARD,borderRadius:10,border:"1px solid "+BORDER,marginBottom:12}}>
            Player prop hit rates this season — how often each batter has covered common prop lines.
          </div>
          <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,paddingBottom:4}}>
            {PROP_CATS.map(function(cat) {
              var isActive = activeProp===cat;
              return (
                <button key={cat} onClick={function(){setActiveProp(cat);}}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                    cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                    background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":MUTED}}>
                  {PROP_LABELS[cat]}
                </button>
              );
            })}
          </div>
          <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
            overflow:"hidden",marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"24px 1fr 44px 60px 52px 60px",
              padding:"8px 12px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
              {["#","BATTER","POS","Record","Hit%","Streak"].map(function(h) {
                return (
                  <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:h==="#"||h==="BATTER"?"left":"center"}}>{h}</div>
                );
              })}
            </div>
            {(BATTING_LINEUPS[team]||[]).map(function(p, i) {
              var pd = (PROP_DATA[team]||[])[i] || {};
              var rec = pd.rec ? pd.rec[activeProp] : "--";
              var pct = pd.pct ? pd.pct[activeProp] : 0;
              var str = pd.str ? pd.str[activeProp] : "--";
              var lbl = pd.label || "Avg";
              var pctColor = pct>=65 ? POS_C : pct<=40 ? NEG_C : TEXT2;
              var lblColor = lbl==="Hot" ? HOT_C : lbl==="Cold" ? COLD_C : MUTED;
              var lblBg = lbl==="Hot" ? "rgba(255,107,43,.12)" :
                          lbl==="Cold" ? "rgba(125,212,252,.1)" : "rgba(255,255,255,.04)";
              var strW = str && str.charAt(str.length-1)==="W";
              var strColor = strW ? POS_C : str&&str.charAt(str.length-1)==="L" ? NEG_C : MUTED;
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"24px 1fr 44px 60px 52px 60px",
                  padding:"9px 12px",alignItems:"center",
                  borderBottom:i<(BATTING_LINEUPS[team]||[]).length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <div style={{fontSize:10,color:MUTED,fontWeight:600}}>{i+1}</div>
                  <div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:4,
                      marginBottom:3,padding:"1px 6px",borderRadius:8,background:lblBg}}>
                      <span style={{fontSize:8,fontWeight:700,color:lblColor}}>
                        {lbl==="Hot"?"🔥 Hot":lbl==="Cold"?"❄️ Cold":"— Avg"}
                      </span>
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:TEXT}}>{p.name}</div>
                  </div>
                  <div style={{textAlign:"center",fontSize:10,color:MUTED}}>{p.pos}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:pct>=65?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{rec||"--"}</div>
                  <div style={{textAlign:"center",fontSize:13,fontWeight:800,
                    color:pctColor,fontFamily:"'IBM Plex Mono',monospace"}}>
                    {pct ? pct+"%" : "--"}
                  </div>
                  <div style={{textAlign:"center"}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",
                      borderRadius:8,background:strColor+"18",color:strColor,
                      fontFamily:"'IBM Plex Mono',monospace"}}>{str||"--"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {label:"🏆 BEST",   color:POS_C, bg:"rgba(52,211,153,.07)", border:"rgba(52,211,153,.2)", asc:false},
              {label:"📉 LOWEST", color:NEG_C, bg:"rgba(255,90,90,.07)",  border:"rgba(255,90,90,.2)",  asc:true},
            ].map(function(card) {
              var items = (BATTING_LINEUPS[team]||[])
                .map(function(p2, i2) {
                  var pd2 = (PROP_DATA[team]||[])[i2] || {};
                  return {name:p2.name.split(",")[0], pct:(pd2.pct||{})[activeProp]||0};
                })
                .sort(function(a,b){ return card.asc ? a.pct-b.pct : b.pct-a.pct; })
                .slice(0,2);
              return (
                <div key={card.label} style={{background:card.bg,
                  border:"1px solid "+card.border,borderRadius:12,padding:"12px"}}>
                  <div style={{fontSize:9,fontWeight:800,color:card.color,
                    letterSpacing:".08em",marginBottom:8}}>{card.label}</div>
                  {items.map(function(item, j) {
                    return (
                      <div key={j} style={{display:"flex",alignItems:"center",
                        justifyContent:"space-between",marginBottom:j===0?6:0}}>
                        <span style={{fontSize:11,color:TEXT2}}>{item.name}</span>
                        <span style={{fontSize:13,fontWeight:800,color:card.color,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{item.pct}%</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view==="Game Stats" && (
        <div>
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:8,paddingBottom:4}}>
        {["All Teams / Season","H2H / Season","vs This SP / Season","Last 5"].map(function(f) {
          var isActive = filter===f;
          return (
            <button key={f} onClick={function(){setFilter(f);}}
              style={{padding:"4px 10px",borderRadius:14,fontSize:10,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {f}
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
        {["Standard","Advanced","Splits","Hot/Cold"].map(function(sv) {
          var isActive = statView===sv;
          return (
            <button key={sv} onClick={function(){setStatView(sv);}}
              style={{padding:"5px 12px",borderRadius:14,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {sv}
            </button>
          );
        })}
      </div>

      {statView==="Standard" && (
        <div>
          <div style={{background:CARD,borderRadius:12,overflow:"hidden",
            border:"1px solid "+BORDER}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",
              padding:"8px 10px",background:CARD3,
              borderBottom:"1px solid "+BORDER}}>
              {["BATTER","AVG","OBP","SLG","OPS","PA"].map(function(h) {
                return (
                  <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:h==="BATTER"?"left":"center"}}>
                    {h}
                  </div>
                );
              })}
            </div>
            {lineup.map(function(p, i) {
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",
                  padding:"9px 10px",
                  borderBottom:i<lineup.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <PlayerName p={p}/>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:avgColor(p.std.avg),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.std.avg}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.std.obp}</div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.std.slg}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:opsColor(p.std.ops),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.std.ops}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,color:MUTED}}>{p.std.pa}</div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10,padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>STAT GUIDE</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              AVG .300+ elite · OPS .850+ strong · .680 or below weak ·
              Green = above avg · Red = below avg
            </div>
          </div>
        </div>
      )}

      {statView==="Advanced" && (
        <div>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",
            marginBottom:8}}>QUALITY OF CONTACT</div>
          <div style={{background:CARD,borderRadius:12,overflow:"hidden",
            border:"1px solid "+BORDER,marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr",
              padding:"8px 10px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
              {[
                {h:"BATTER",tip:null},
                {h:"wOBA",tip:"Weighted on-base avg — most accurate offensive value metric"},
                {h:"wRC+",tip:"100 = league avg. 130+ = elite, 85 or below = below avg"},
                {h:"xBA",tip:"Expected BA based on contact quality — predicts future AVG"},
                {h:"xSLG",tip:"Expected SLG based on exit velocity and launch angle"},
                {h:"Hard%",tip:"Hard contact rate (95mph+). 45%+ is elite territory"},
                {h:"Barrel%",tip:"Barrel rate — optimal exit velo + angle combo. 8%+ = elite"},
              ].map(function(col) {
                return (
                  <div key={col.h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:col.h==="BATTER"?"left":"center",
                    display:"flex",alignItems:"center",
                    justifyContent:col.h==="BATTER"?"flex-start":"center",gap:2}}>
                    {col.h}
                    {col.tip && (
                      <span title={col.tip}
                        style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                          width:11,height:11,borderRadius:"50%",background:ACCENT+"22",
                          fontSize:6,color:ACCENT,cursor:"pointer",flexShrink:0}}>i</span>
                    )}
                  </div>
                );
              })}
            </div>
            {lineup.map(function(p, i) {
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                  padding:"9px 10px",
                  borderBottom:i<lineup.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <PlayerName p={p}/>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:opsColor(p.adv.woba),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.woba}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:wrcColor(p.adv.wrc),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.wrc}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,color:avgColor(p.adv.xba),
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.adv.xba}</div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.adv.xslg}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:hardColor(p.adv.hard),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.hard}%
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:p.adv.barrel>=8?POS_C:p.adv.barrel<=4?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.barrel}%
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",
            marginBottom:8}}>PLATE DISCIPLINE</div>
          <div style={{background:CARD,borderRadius:12,overflow:"hidden",
            border:"1px solid "+BORDER,marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
              padding:"8px 10px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
              {[
                {h:"BATTER",tip:null},
                {h:"K%",tip:"Strikeout rate. Lower = better contact. 15% or below is elite"},
                {h:"BB%",tip:"Walk rate. Higher = better plate discipline. 10%+ is strong"},
                {h:"Chase%",tip:"Swing rate on pitches outside the zone. Lower = better discipline"},
                {h:"Whiff%",tip:"Miss rate per swing. Lower = better contact ability"},
              ].map(function(col) {
                return (
                  <div key={col.h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:col.h==="BATTER"?"left":"center",
                    display:"flex",alignItems:"center",
                    justifyContent:col.h==="BATTER"?"flex-start":"center",gap:2}}>
                    {col.h}
                    {col.tip && (
                      <span title={col.tip}
                        style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                          width:11,height:11,borderRadius:"50%",background:ACCENT+"22",
                          fontSize:6,color:ACCENT,cursor:"pointer",flexShrink:0}}>i</span>
                    )}
                  </div>
                );
              })}
            </div>
            {lineup.map(function(p, i) {
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                  padding:"9px 10px",
                  borderBottom:i<lineup.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <PlayerName p={p}/>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:p.adv.kpct<=18?POS_C:p.adv.kpct>=26?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.kpct}%
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:p.adv.bbpct>=10?POS_C:p.adv.bbpct<=6?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.bbpct}%
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:p.adv.chase<=24?POS_C:p.adv.chase>=34?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.chase}%
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:p.adv.whiff<=20?POS_C:p.adv.whiff>=30?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.adv.whiff}%
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>STAT GUIDE</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              wRC+ 100 = avg · Hard Hit% 45%+ = elite · Chase% lower = better ·
              Whiff% lower = better · K% 15% or below = elite contact
            </div>
          </div>
        </div>
      )}

      {statView==="Splits" && (
        <div>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",
            marginBottom:8}}>HANDEDNESS SPLITS (VS LHP / VS RHP)</div>
          <div style={{background:CARD,borderRadius:12,overflow:"hidden",
            border:"1px solid "+BORDER,marginBottom:14}}>
            <div style={{display:"grid",
              gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr",
              padding:"8px 10px",background:CARD3,borderBottom:"1px solid "+BORDER,
              overflowX:"auto"}}>
              {[
                {h:"BATTER",tip:null},
                {h:"vsL AVG",tip:"Batting avg vs left-handed pitching"},
                {h:"vsL OPS",tip:"OPS vs left-handed pitching"},
                {h:"vsR AVG",tip:"Batting avg vs right-handed pitching — most relevant tonight"},
                {h:"vsR OPS",tip:"OPS vs right-handed pitching"},
                {h:"Home OPS",tip:"OPS at home ballpark"},
                {h:"Away OPS",tip:"OPS on the road"},
              ].map(function(col) {
                return (
                  <div key={col.h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:col.h==="BATTER"?"left":"center",
                    display:"flex",alignItems:"center",
                    justifyContent:col.h==="BATTER"?"flex-start":"center",gap:2,
                    whiteSpace:"nowrap"}}>
                    {col.h}
                    {col.tip && (
                      <span style={{display:"inline-flex",alignItems:"center",
                        justifyContent:"center",width:11,height:11,
                        borderRadius:"50%",background:ACCENT+"22",
                        fontSize:6,color:ACCENT,cursor:"pointer",flexShrink:0}}>
                        i
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{overflowX:"auto"}}>
              {lineup.map(function(p, i) {
                return (
                  <div key={i} style={{display:"grid",
                    gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    padding:"9px 10px",minWidth:480,
                    borderBottom:i<lineup.length-1?"1px solid "+BORDER:"none",
                    background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                    <PlayerName p={p}/>
                    <div style={{textAlign:"center",fontSize:11,color:avgColor(p.splits.vslAvg),
                      fontFamily:"'IBM Plex Mono',monospace"}}>{p.splits.vslAvg}</div>
                    <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                      color:opsColor(p.splits.vslOps),fontFamily:"'IBM Plex Mono',monospace"}}>
                      {p.splits.vslOps}
                    </div>
                    <div style={{textAlign:"center",fontSize:11,color:avgColor(p.splits.vsrAvg),
                      fontFamily:"'IBM Plex Mono',monospace"}}>{p.splits.vsrAvg}</div>
                    <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                      color:opsColor(p.splits.vsrOps),fontFamily:"'IBM Plex Mono',monospace"}}>
                      {p.splits.vsrOps}
                    </div>
                    <div style={{textAlign:"center",fontSize:11,color:opsColor(p.splits.homeOps),
                      fontFamily:"'IBM Plex Mono',monospace"}}>{p.splits.homeOps}</div>
                    <div style={{textAlign:"center",fontSize:11,color:opsColor(p.splits.awayOps),
                      fontFamily:"'IBM Plex Mono',monospace"}}>{p.splits.awayOps}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",
            marginBottom:8}}>SITUATIONAL SPLITS</div>
          <div style={{background:CARD,borderRadius:12,overflow:"hidden",
            border:"1px solid "+BORDER,marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
              padding:"8px 10px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
              {[
                {h:"BATTER",tip:null},
                {h:"ROB AVG",tip:"Batting avg with runners on base"},
                {h:"ROB OPS",tip:"OPS with runners on base — clutch hitting indicator"},
                {h:"RISP AVG",tip:"Avg with runners in scoring position — most predictive"},
                {h:"RISP OPS",tip:"OPS with RISP"},
              ].map(function(col) {
                return (
                  <div key={col.h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:col.h==="BATTER"?"left":"center",
                    display:"flex",alignItems:"center",
                    justifyContent:col.h==="BATTER"?"flex-start":"center",gap:2}}>
                    {col.h}
                    {col.tip && (
                      <span style={{display:"inline-flex",alignItems:"center",
                        justifyContent:"center",width:11,height:11,
                        borderRadius:"50%",background:ACCENT+"22",
                        fontSize:6,color:ACCENT,cursor:"pointer",flexShrink:0}}>
                        i
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {lineup.map(function(p, i) {
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                  padding:"9px 10px",
                  borderBottom:i<lineup.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <PlayerName p={p}/>
                  <div style={{textAlign:"center",fontSize:11,color:avgColor(p.sit.robAvg),
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.sit.robAvg}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:opsColor(p.sit.robOps),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.sit.robOps}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:avgColor(p.sit.riscAvg),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.sit.riscAvg}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:opsColor(p.sit.riscOps),fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.sit.riscOps}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>TONIGHT'S CONTEXT</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              {team} faces Gerrit Cole (RHP). Check vsR OPS — most relevant split
              tonight. RISP shows clutch hitting ability.
            </div>
          </div>
        </div>
      )}

      {statView==="Hot/Cold" && (
        <div>
          <div style={{background:CARD,borderRadius:12,overflow:"hidden",
            border:"1px solid "+BORDER,marginBottom:10}}>
            <div style={{display:"grid",
              gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",
              padding:"8px 10px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
              {[
                {h:"BATTER",tip:null},
                {h:"L7 AVG",tip:"Batting avg over last 7 games — most predictive for tonight"},
                {h:"HR",tip:"Home runs last 7 games"},
                {h:"RBI",tip:"RBI last 7 games"},
                {h:"L14 AVG",tip:"Batting avg over last 14 games"},
                {h:"HR",tip:"Home runs last 14 games"},
              ].map(function(col, ci) {
                return (
                  <div key={ci} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:col.h==="BATTER"?"left":"center",
                    display:"flex",alignItems:"center",
                    justifyContent:col.h==="BATTER"?"flex-start":"center",gap:2}}>
                    {col.h}
                    {col.tip && (
                      <span style={{display:"inline-flex",alignItems:"center",
                        justifyContent:"center",width:11,height:11,
                        borderRadius:"50%",background:ACCENT+"22",
                        fontSize:6,color:ACCENT,cursor:"pointer",flexShrink:0}}>
                        i
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {lineup.map(function(p, i) {
              var l7n = parseFloat(p.hotcold.l7avg);
              var l14n = parseFloat(p.hotcold.l14avg);
              var l7hot = l7n >= 0.300;
              var l7cold = l7n <= 0.200;
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",
                  padding:"9px 10px",
                  borderBottom:i<lineup.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <PlayerName p={p}/>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:l7hot?POS_C:l7cold?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.hotcold.l7avg}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.hotcold.l7hr}</div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.hotcold.l7rbi}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:l14n>=0.290?POS_C:l14n<=0.210?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.hotcold.l14avg}
                  </div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{p.hotcold.l14hr}</div>
                </div>
              );
            })}
          </div>
          <div style={{padding:"10px 12px",background:"rgba(255,107,43,.08)",
            borderRadius:10,border:"1px solid rgba(255,107,43,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:HOT_C,
              letterSpacing:".1em",marginBottom:4}}>RECENT FORM</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              🔥 Hot = .300+ last 7G · ❄️ Cold = .200 or below · Most predictive
              window for prop bets tonight.
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
// ── BULLPEN DATA ──────────────────────────────────────────────────────────────
var BULLPEN_DATA = {
  BOS: {
    health: 62, status: "Taxed",
    teamStats: {
      era:"4.21",   eraRank:22,
      whip:"1.38",  whipRank:24,
      k9:"9.1",     k9Rank:14,
      bb9:"3.4",    bb9Rank:26,
      sv:"14",      svRank:18,
      hold:"28",    holdRank:16,
      blowSv:"6",   blowRank:22,
      oppAvg:".248",oppAvgRank:20,
    },
    last5: ["W","W","L","L","W"],
    pitchers: [
      {name:"Chris Martin",    role:"CL", hand:"RHP", status:"taxed",
       lastUsed:"Yesterday", rest:"1d rest",
       era:"2.14", whip:"0.98", k9:"10.2", bb9:"2.1", hold:"88%",
       pitches3d:40, pitchBreak:"22 / 0 / 18",
       last5:["W","W","L","L","W"], trend:"up"},
      {name:"Josh Winckowski", role:"SU", hand:"RHP", status:"taxed",
       lastUsed:"Yesterday", rest:"1d rest",
       era:"3.44", whip:"1.12", k9:"8.4", bb9:"3.1", hold:"72%",
       pitches3d:28, pitchBreak:"14 / 0 / 14",
       last5:["W","L","W","L","W"], trend:"down"},
      {name:"Brennan Bernardino",role:"SU",hand:"LHP",status:"used",
       lastUsed:"2 days ago", rest:"2d rest",
       era:"3.88", whip:"1.24", k9:"9.1", bb9:"2.8", hold:"68%",
       pitches3d:19, pitchBreak:"0 / 19 / 0",
       last5:["W","W","L","W","L"], trend:"down"},
      {name:"Kaleb Ort",        role:"MR", hand:"RHP", status:"rested",
       lastUsed:"3 days ago", rest:"3d rest",
       era:"4.21", whip:"1.31", k9:"7.8", bb9:"3.4", hold:"58%",
       pitches3d:22, pitchBreak:"0 / 0 / 22",
       last5:["L","W","W","L","W"], trend:"neutral"},
      {name:"Justin Slaten",    role:"MR", hand:"RHP", status:"taxed",
       lastUsed:"Yesterday", rest:"1d rest",
       era:"3.92", whip:"1.18", k9:"8.8", bb9:"2.9", hold:"64%",
       pitches3d:15, pitchBreak:"15 / 0 / 0",
       last5:["W","L","W","W","L"], trend:"neutral"},
      {name:"Bailey Horn",      role:"LR", hand:"LHP", status:"rested",
       lastUsed:"4 days ago", rest:"4d rest",
       era:"5.14", whip:"1.48", k9:"7.2", bb9:"4.1", hold:"44%",
       pitches3d:31, pitchBreak:"0 / 0 / 31",
       last5:["L","L","W","L","W"], trend:"down"},
    ],
  },
  NYY: {
    health: 84, status: "Fresh",
    teamStats: {
      era:"2.88",   eraRank:4,
      whip:"1.08",  whipRank:5,
      k9:"10.4",    k9Rank:6,
      bb9:"2.6",    bb9Rank:8,
      sv:"18",      svRank:8,
      hold:"34",    holdRank:5,
      blowSv:"3",   blowRank:6,
      oppAvg:".218",oppAvgRank:4,
    },
    last5: ["W","W","W","L","W"],
    pitchers: [
      {name:"Clay Holmes",     role:"CL", hand:"RHP", status:"rested",
       lastUsed:"2 days ago", rest:"2d rest",
       era:"1.84", whip:"0.88", k9:"11.2", bb9:"1.8", hold:"91%",
       pitches3d:18, pitchBreak:"0 / 18 / 0",
       last5:["W","W","W","W","W"], trend:"up"},
      {name:"Tommy Kahnle",    role:"SU", hand:"RHP", status:"used",
       lastUsed:"Yesterday", rest:"1d rest",
       era:"2.44", whip:"0.94", k9:"12.1", bb9:"2.1", hold:"84%",
       pitches3d:22, pitchBreak:"22 / 0 / 0",
       last5:["W","W","W","L","W"], trend:"up"},
      {name:"Victor Gonzalez", role:"SU", hand:"LHP", status:"rested",
       lastUsed:"3 days ago", rest:"3d rest",
       era:"3.12", whip:"1.08", k9:"9.4", bb9:"2.4", hold:"76%",
       pitches3d:0, pitchBreak:"0 / 0 / 0",
       last5:["W","L","W","W","W"], trend:"up"},
      {name:"Ron Marinaccio",  role:"MR", hand:"RHP", status:"rested",
       lastUsed:"4 days ago", rest:"4d rest",
       era:"3.68", whip:"1.14", k9:"10.1", bb9:"3.2", hold:"70%",
       pitches3d:0, pitchBreak:"0 / 0 / 0",
       last5:["W","W","L","W","W"], trend:"neutral"},
      {name:"Ian Hamilton",    role:"MR", hand:"RHP", status:"used",
       lastUsed:"2 days ago", rest:"2d rest",
       era:"3.28", whip:"1.06", k9:"9.8", bb9:"2.6", hold:"74%",
       pitches3d:14, pitchBreak:"0 / 14 / 0",
       last5:["W","W","W","W","L"], trend:"up"},
    ],
  },
};

// ── PITCHING DATA ─────────────────────────────────────────────────────────────
var PITCHER_STATS = {
  away: {
    name:"Brayan Bello", hot:false, abbr:"BOS",
    avgIP:"5.4", qsPct:"52%",
    era:"3.84", fip:"4.18", xfip:"4.61", siera:"4.44",
    k9:"8.4", bb9:"3.2", whip:"1.28", csw:"27.4%", kbb:"12.8%",
    babip:".301", strand:"68.4%", f1era:"2.81", hr9:"1.1",
    firstStrike:"58.4%", gb:"42.1%", fb:"38.4%",
    veloAvg:"95.2 mph", veloTrend:"-0.4 mph last 3 starts",
    arsenal:{FB:"52.1%",SL:"24.8%",CH:"14.4%",CB:"8.7%"},
    contact:{hardHit:"42.8%",barrel:"9.4%",exitVelo:"91.8 mph",gb:"42.1%",strand:"68.4%"},
    splits:{
      vsLHH:{era:"3.24",avg:".241"}, vsRHH:{era:"4.44",avg:".298"},
      homeEra:"3.41", awayEra:"4.28",
    },
    last3:[
      {opp:"TB",  date:"Start 3", ip:"5.2", er:2,  k:6,  bb:2, result:"W"},
      {opp:"BAL", date:"Start 2", ip:"4.1", er:5,  k:4,  bb:3, result:"L"},
      {opp:"NYY", date:"Start 1", ip:"5.0", er:3,  k:7,  bb:2, result:"L"},
    ],
    bet:{
      k_over:{rec:"14-8", pct:64, line:"Over 7.5 K"},
      k_under:{rec:"8-14", pct:36, line:"Under 7.5 K"},
      win:{rec:"8-14",  pct:36, line:"Win prop -145"},
      nrfi:{rec:"12-10",pct:55, line:"NRFI -118"},
      outs:{rec:"11-11",pct:50, line:"Over 15.5 outs"},
      era:{rec:"10-12", pct:45, line:"Under 4.5 ERA line"},
    },
    vsLineup:[
      {name:"Judge, A.",    pos:"RF", avg:".211", ab:19, h:4, hr:1, k:6},
      {name:"Soto, J.",     pos:"LF", avg:".286", ab:14, h:4, hr:0, k:3},
      {name:"Stanton, G.", pos:"DH", avg:".167", ab:12, h:2, hr:1, k:5},
      {name:"Rizzo, A.",    pos:"1B", avg:".333", ab:9,  h:3, hr:0, k:2},
      {name:"LeMahieu, D.",pos:"3B", avg:".250", ab:8,  h:2, hr:0, k:1},
      {name:"Torres, G.",  pos:"2B", avg:".143", ab:7,  h:1, hr:0, k:3},
      {name:"Trevino, J.", pos:"C",  avg:".182", ab:11, h:2, hr:0, k:4},
      {name:"Volpe, A.",   pos:"SS", avg:".222", ab:9,  h:2, hr:0, k:3},
      {name:"Bauers, J.",  pos:"CF", avg:".100", ab:10, h:1, hr:0, k:4},
    ],
  },
  home: {
    name:"Gerrit Cole", hot:true, abbr:"NYY",
    avgIP:"6.8", qsPct:"74%",
    era:"2.91", fip:"2.44", xfip:"2.88", siera:"2.76",
    k9:"11.4", bb9:"1.8", whip:"0.97", csw:"34.1%", kbb:"22.8%",
    babip:".271", strand:"82.1%", f1era:"1.84", hr9:"0.6",
    firstStrike:"64.2%", gb:"38.4%", fb:"52.1%",
    veloAvg:"97.1 mph", veloTrend:"+0.3 mph last 3 starts",
    arsenal:{FF:"54.2%",SL:"21.3%",CH:"15.8%",CU:"8.7%"},
    contact:{hardHit:"28.2%",barrel:"4.1%",exitVelo:"87.3 mph",gb:"38.4%",strand:"82.1%"},
    splits:{
      vsLHH:{era:"2.44",avg:".198"}, vsRHH:{era:"3.28",avg:".241"},
      homeEra:"2.11", awayEra:"3.44",
    },
    last3:[
      {opp:"BOS", date:"Start 3", ip:"7.0", er:2, k:11, bb:1, result:"W"},
      {opp:"TB",  date:"Start 2", ip:"6.1", er:1, k:9,  bb:2, result:"W"},
      {opp:"BOS", date:"Start 1", ip:"7.2", er:2, k:10, bb:0, result:"W"},
    ],
    bet:{
      k_over:{rec:"19-6", pct:76, line:"Over 8.5 K"},
      k_under:{rec:"6-19", pct:24, line:"Under 8.5 K"},
      win:{rec:"12-6",  pct:67, line:"Win prop -165"},
      nrfi:{rec:"14-8", pct:64, line:"NRFI -135"},
      outs:{rec:"16-8", pct:67, line:"Over 17.5 outs"},
      era:{rec:"15-9",  pct:63, line:"Under 3.5 ERA line"},
    },
    vsLineup:[
      {name:"Yoshida, M.", pos:"LF", avg:".264", ab:19, h:5, hr:0, k:4},
      {name:"Devers, R.",  pos:"3B", avg:".312", ab:16, h:5, hr:2, k:3},
      {name:"Casas, T.",   pos:"1B", avg:".182", ab:11, h:2, hr:0, k:4},
      {name:"O'Neill, T.", pos:"RF", avg:".154", ab:13, h:2, hr:0, k:5},
      {name:"Duvall, A.",  pos:"DH", avg:".133", ab:15, h:2, hr:1, k:6},
      {name:"Valdez, E.",  pos:"SS", avg:".231", ab:13, h:3, hr:0, k:3},
      {name:"Wong, C.",    pos:"2B", avg:".200", ab:10, h:2, hr:0, k:2},
      {name:"Hamilton, D.",pos:"CF", avg:".167", ab:12, h:2, hr:0, k:3},
      {name:"Mayer, M.",   pos:"SS", avg:".143", ab:7,  h:1, hr:0, k:3},
    ],
  },
};

// ── BULLPEN PITCHER CARD ──────────────────────────────────────────────────────
function BullpenPitcher(props) {
  var p = props.p;
  var expandedArr = useState(false);
  var expanded = expandedArr[0]; var setExpanded = expandedArr[1];

  var statusColor = p.status==="rested" ? POS_C :
                    p.status==="used"   ? WARN_C : NEG_C;
  var statusLabel = p.status==="rested" ? "Rested" :
                    p.status==="used"   ? "Used" : "Taxed";
  var trendColor = p.trend==="up" ? POS_C : p.trend==="down" ? NEG_C : MUTED;
  var trendArrow = p.trend==="up" ? "▲" : p.trend==="down" ? "▼" : "—";
  var eraNum = parseFloat(p.era);
  var eraColor = eraNum<3.0?POS_C:eraNum>4.5?NEG_C:WARN_C;

  return (
    <div style={{borderBottom:"1px solid "+BORDER}}>
      <div onClick={function(){setExpanded(!expanded);}}
        style={{padding:"12px 14px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:10,height:10,borderRadius:"50%",
              background:statusColor,flexShrink:0}}/>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{p.name}</span>
                <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",
                  borderRadius:6,background:CARD3,border:"1px solid "+BORDER,
                  color:MUTED}}>{p.role}</span>
                <span style={{fontSize:9,color:MUTED}}>{p.hand}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:10,color:p.status==="taxed"?NEG_C:p.status==="used"?WARN_C:POS_C,
                  fontWeight:600}}>{p.lastUsed}</span>
                <span style={{fontSize:10,color:MUTED}}>· {p.rest}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:16,fontWeight:900,color:eraColor,
                fontFamily:"'IBM Plex Mono',monospace"}}>{p.era}</div>
              <div style={{fontSize:8,color:MUTED}}>ERA</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{fontSize:10,color:TEXT2,fontFamily:"'IBM Plex Mono',monospace",
                fontWeight:600}}>{p.pitches3d}</div>
              <div style={{fontSize:7,color:MUTED}}>P last 3d</div>
            </div>
            <span style={{fontSize:12,color:trendColor,fontWeight:800}}>
              {trendArrow}
            </span>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{padding:"0 14px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",
            gap:8,marginBottom:12}}>
            {[
              {label:"WHIP",  val:p.whip,  good:parseFloat(p.whip)<1.15},
              {label:"K/9",   val:p.k9,    good:parseFloat(p.k9)>9},
              {label:"BB/9",  val:p.bb9,   good:parseFloat(p.bb9)<2.5},
              {label:"Hold%", val:p.hold,  good:parseFloat(p.hold)>70},
            ].map(function(stat) {
              var c = stat.good ? POS_C : TEXT2;
              return (
                <div key={stat.label} style={{background:CARD3,borderRadius:10,
                  padding:"8px 6px",textAlign:"center"}}>
                  <div style={{fontSize:13,fontWeight:800,color:c,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                    {stat.val}
                  </div>
                  <div style={{fontSize:8,color:MUTED}}>{stat.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,color:MUTED,marginBottom:6}}>Last 5 Outings</div>
            <div style={{display:"flex",gap:6}}>
              {p.last5.map(function(r, i) {
                var isW = r==="W";
                return (
                  <div key={i} style={{flex:1,padding:"7px 4px",borderRadius:8,
                    background:isW?"rgba(52,211,153,.15)":"rgba(255,90,90,.15)",
                    border:"1px solid "+(isW?"rgba(52,211,153,.3)":"rgba(255,90,90,.3)"),
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:12,color:isW?POS_C:NEG_C,fontWeight:800}}>
                      {isW?"v":"x"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {p.pitches3d > 0 && (
            <div style={{fontSize:10,color:TEXT2}}>
              Pitches last 3 days:{" "}
              <span style={{color:p.pitches3d>=35?NEG_C:p.pitches3d>=20?WARN_C:POS_C,
                fontWeight:800,fontFamily:"'IBM Plex Mono',monospace"}}>
                {p.pitches3d} total
              </span>
              <span style={{color:MUTED}}> ({p.pitchBreak})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── BULLPEN TAB CONTENT ───────────────────────────────────────────────────────
function BullpenContent(props) {
  var bullpenSideArr = useState("BOS");
  var bullpenSide = bullpenSideArr[0]; var setBullpenSide = bullpenSideArr[1];

  var bp = BULLPEN_DATA[bullpenSide] || {health:0,status:"",last5:[],pitchers:[]};
  var opp = bullpenSide==="BOS" ? "NYY" : "BOS";
  var bpOpp = BULLPEN_DATA[opp] || {health:0,status:"",last5:[],pitchers:[]};
  var tc = TEAM_C[bullpenSide] || ACCENT;
  var tcOpp = TEAM_C[opp] || ACCENT;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {abbr:bullpenSide, data:bp,    active:true},
          {abbr:opp,         data:bpOpp, active:false},
        ].map(function(item) {
          var btc = TEAM_C[item.abbr] || ACCENT;
          var isActive = item.abbr===bullpenSide;
          var hColor = item.data.health>=75?POS_C:item.data.health>=55?WARN_C:NEG_C;
          var last5colors = (item.data.last5||[]).map(function(r){
            return r==="W"?POS_C:r==="L"?NEG_C:WARN_C;
          });
          return (
            <div key={item.abbr}
              onClick={function(){setBullpenSide(item.abbr);}}
              style={{background:CARD,border:"2px solid "+(isActive?btc:BORDER),
                borderRadius:14,padding:"12px",cursor:"pointer",
                background:isActive?btc+"12":CARD}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:12}}>⚾</span>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:TEXT}}>
                    {item.abbr} Bullpen
                  </div>
                  <div style={{fontSize:11,fontWeight:700,
                    color:item.data.health>=75?POS_C:item.data.health>=55?WARN_C:NEG_C}}>
                    {item.data.status}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{flex:1,height:4,background:BORDER2,borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:item.data.health+"%",
                    background:hColor,borderRadius:2}}/>
                </div>
                <span style={{fontSize:14,fontWeight:900,color:hColor,
                  fontFamily:"'IBM Plex Mono',monospace",minWidth:28}}>
                  {item.data.health}
                </span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {last5colors.map(function(c, i) {
                  return (
                    <div key={i} style={{width:12,height:12,borderRadius:"50%",background:c}}/>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
        overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
            {bullpenSide} RELIEF CORPS
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {[[POS_C,"Rested"],[WARN_C,"Used"],[NEG_C,"Taxed"]].map(function(item) {
              return (
                <div key={item[1]} style={{display:"flex",alignItems:"center",gap:3}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:item[0]}}/>
                  <span style={{fontSize:8,color:MUTED}}>{item[1]}</span>
                </div>
              );
            })}
          </div>
        </div>
        {bp.pitchers.map(function(p, i) {
          return (<BullpenPitcher key={i} p={p}/>);
        })}
      </div>
      <div style={{marginTop:14,background:CARD,border:"1px solid "+BORDER,
        borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER}}>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
            {bullpenSide} BULLPEN — TEAM STATS & LEAGUE RANK
          </div>
        </div>
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[
              {label:"Team ERA",  val:(bp.teamStats||{}).era,    rank:(bp.teamStats||{}).eraRank,    good:(bp.teamStats||{}).eraRank<=10},
              {label:"WHIP",      val:(bp.teamStats||{}).whip,   rank:(bp.teamStats||{}).whipRank,   good:(bp.teamStats||{}).whipRank<=10},
              {label:"K/9",       val:(bp.teamStats||{}).k9,     rank:(bp.teamStats||{}).k9Rank,     good:(bp.teamStats||{}).k9Rank<=10},
              {label:"BB/9",      val:(bp.teamStats||{}).bb9,    rank:(bp.teamStats||{}).bb9Rank,    good:(bp.teamStats||{}).bb9Rank<=10},
              {label:"Saves",     val:(bp.teamStats||{}).sv,     rank:(bp.teamStats||{}).svRank,     good:(bp.teamStats||{}).svRank<=10},
              {label:"Holds",     val:(bp.teamStats||{}).hold,   rank:(bp.teamStats||{}).holdRank,   good:(bp.teamStats||{}).holdRank<=10},
              {label:"Blown Sv",  val:(bp.teamStats||{}).blowSv, rank:(bp.teamStats||{}).blowRank,   good:(bp.teamStats||{}).blowRank<=10},
              {label:"Opp AVG",   val:(bp.teamStats||{}).oppAvg, rank:(bp.teamStats||{}).oppAvgRank, good:(bp.teamStats||{}).oppAvgRank<=10},
            ].map(function(stat) {
              var rankColor = stat.rank<=5?POS_C:stat.rank<=15?ACCENT:stat.rank<=25?WARN_C:NEG_C;
              return (
                <div key={stat.label} style={{background:CARD3,borderRadius:10,
                  padding:"10px 10px",display:"flex",alignItems:"center",
                  justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{stat.label}</div>
                    <div style={{fontSize:15,fontWeight:900,
                      color:stat.good?POS_C:NEG_C,
                      fontFamily:"'IBM Plex Mono',monospace"}}>{stat.val}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Rank</div>
                    <div style={{fontSize:14,fontWeight:800,color:rankColor,
                      fontFamily:"'IBM Plex Mono',monospace"}}>
                      {"#"+stat.rank}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{padding:"8px 12px",background:AGL,
            borderRadius:8,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>RANKING CONTEXT</div>
            <div style={{fontSize:9,color:TEXT2,lineHeight:1.5}}>
              Rankings out of 30 MLB teams · #1-5 = elite · Green = top 10 · Yellow = mid · Red = bottom 10
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
function StatBox(props) {
  var label=props.label; var val=props.val; var good=props.good; var small=props.small;
  var c = good===true?POS_C:good===false?NEG_C:TEXT2;
  return (
    <div style={{background:CARD3,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
      <div style={{fontSize:9,color:MUTED,marginBottom:6,display:"flex",
        alignItems:"center",justifyContent:"center",gap:2}}>
        {label}
        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
          width:11,height:11,borderRadius:"50%",background:ACCENT+"22",
          fontSize:6,color:ACCENT,cursor:"pointer"}}>i</span>
      </div>
      <div style={{fontSize:small?14:18,fontWeight:900,color:c,
        fontFamily:"'IBM Plex Mono',monospace"}}>{val}</div>
    </div>
  );
}

function PitchingTab() {
  var modeArr = useState("Starters");
  var mode = modeArr[0]; var setMode = modeArr[1];
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var spArr = useState("away");
  var spSide = spArr[0]; var setSpSide = spArr[1];
  var tabArr = useState("Overview");
  var tab = tabArr[0]; var setTab = tabArr[1];

  var p = spSide==="away" ? PITCHER_STATS.away : PITCHER_STATS.home;
  var opp = spSide==="away" ? PITCHER_STATS.home : PITCHER_STATS.away;
  var tc = TEAM_C[p.abbr] || ACCENT;


  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Starters","Bullpen"].map(function(m) {
          var isActive = mode===m;
          return (
            <button key={m} onClick={function(){setMode(m);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,fontWeight:isActive?700:500,
                cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",color:isActive?"#fff":MUTED}}>
              {m==="Starters"?"⚾ Starters":"💪 Bullpen"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,fontWeight:isActive?700:500,
                cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {["away","home"].map(function(side) {
          var ps = side==="away" ? PITCHER_STATS.away : PITCHER_STATS.home;
          var ptc = TEAM_C[ps.abbr] || ACCENT;
          var isActive = spSide===side;
          return (
            <button key={side} onClick={function(){setSpSide(side);}}
              style={{padding:"12px",borderRadius:12,cursor:"pointer",
                border:"2px solid "+(isActive?ptc:BORDER),
                background:isActive?ptc+"22":"transparent",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>
                {ps.abbr} SP
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <span style={{fontSize:11}}>{ps.hot?"🔥":"❄️"}</span>
                <span style={{fontSize:13,fontWeight:800,color:isActive?ptc:TEXT}}>
                  {ps.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {view==="Game Stats" && mode==="Starters" && (
        <div>
          <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
            {["Overview","Advanced","Splits","Last 3 Starts","vs Lineup"].map(function(t) {
              var isActive = tab===t;
              return (
                <button key={t} onClick={function(){setTab(t);}}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                    cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                    background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":MUTED}}>
                  {t}
                </button>
              );
            })}
          </div>

          {tab==="Overview" && (
            <div>
              <div style={{background:CARD,border:"2px solid "+tc,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>{p.hot?"🔥":"❄️"}</span>
                    <div>
                      <div style={{fontSize:9,color:MUTED}}>Starting Pitcher</div>
                      <div style={{fontSize:16,fontWeight:900,color:TEXT}}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:2}}>vs {opp.abbr} tonight</div>
                    <div style={{fontSize:11,color:ACCENT,fontWeight:700}}>
                      {p.avgIP} avg IP · {p.qsPct} QS%
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <StatBox label="ERA"  val={p.era}  good={parseFloat(p.era)<3.5}/>
                  <StatBox label="FIP"  val={p.fip}  good={parseFloat(p.fip)<3.5}/>
                  <StatBox label="xFIP" val={p.xfip} good={parseFloat(p.xfip)<3.5}/>
                  <StatBox label="SIERA"val={p.siera} good={parseFloat(p.siera)<3.5} small={true}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                  <StatBox label="K/9"   val={p.k9}   good={parseFloat(p.k9)>9}/>
                  <StatBox label="BB/9"  val={p.bb9}  good={parseFloat(p.bb9)<2.5}/>
                  <StatBox label="WHIP"  val={p.whip} good={parseFloat(p.whip)<1.15} small={true}/>
                  <StatBox label="CSW%"  val={p.csw}  good={parseFloat(p.csw)>30} small={true}/>
                  <StatBox label="K-BB%" val={p.kbb}  good={parseFloat(p.kbb)>15} small={true}/>
                </div>
              </div>

              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
                    PITCH ARSENAL
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:TEXT}}>{p.veloAvg}</span>
                    <span style={{fontSize:10,fontWeight:700,
                      color:p.veloTrend.charAt(0)==="-"?NEG_C:POS_C}}>
                      {p.veloTrend}
                    </span>
                  </div>
                </div>
                <div style={{display:"grid",
                  gridTemplateColumns:"repeat("+Object.keys(p.arsenal).length+",1fr)",gap:8}}>
                  {Object.keys(p.arsenal).map(function(pitch) {
                    return (
                      <div key={pitch} style={{background:CARD3,borderRadius:10,
                        padding:"10px 6px",textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:900,color:ACCENT,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                          {p.arsenal[pitch]}
                        </div>
                        <div style={{fontSize:9,color:MUTED}}>{pitch}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:12}}>CONTACT QUALITY ALLOWED</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                  {[
                    {label:"Hard Hit%",val:p.contact.hardHit,good:parseFloat(p.contact.hardHit)<35,small:true},
                    {label:"Barrel%", val:p.contact.barrel,  good:parseFloat(p.contact.barrel)<6,small:true},
                    {label:"Exit Velo",val:p.contact.exitVelo,good:parseFloat(p.contact.exitVelo)<88,small:true},
                    {label:"GB%",     val:p.contact.gb,       good:parseFloat(p.contact.gb)>42,small:true},
                    {label:"Strand%", val:p.contact.strand,   good:parseFloat(p.contact.strand)>72,small:true},
                  ].map(function(stat) {
                    return (<StatBox key={stat.label} label={stat.label} val={stat.val}
                      good={stat.good} small={true}/>);
                  })}
                </div>
              </div>

              <div style={{padding:"10px 12px",background:AGL,
                borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
                <div style={{fontSize:9,fontWeight:800,color:ACCENT,
                  letterSpacing:".1em",marginBottom:4}}>COLOR KEY</div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                  Green = elite · Red = concerning · Tap any stat i for explanation
                </div>
              </div>
            </div>
          )}

          {tab==="Advanced" && (
            <div>
              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:10}}>ERA ESTIMATORS & RUN PREVENTION</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
                  <StatBox label="ERA"  val={p.era}   good={parseFloat(p.era)<3.5}/>
                  <StatBox label="FIP"  val={p.fip}   good={parseFloat(p.fip)<3.5}/>
                  <StatBox label="xFIP" val={p.xfip}  good={parseFloat(p.xfip)<3.5}/>
                  <StatBox label="SIERA"val={p.siera}  good={parseFloat(p.siera)<3.5} small={true}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  <StatBox label="WHIP"      val={p.whip}        good={parseFloat(p.whip)<1.15} small={true}/>
                  <StatBox label="BABIP"     val={p.babip}       good={parseFloat(p.babip.replace(".",""))<290} small={true}/>
                  <StatBox label="Strand%"   val={p.strand}      good={parseFloat(p.strand)>72} small={true}/>
                  <StatBox label="1st Inn ERA"val={p.f1era}       good={parseFloat(p.f1era)<3.0} small={true}/>
                </div>
              </div>

              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:10}}>STRIKEOUT & WALK PROFILE</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
                  <StatBox label="K/9"        val={p.k9}          good={parseFloat(p.k9)>9}/>
                  <StatBox label="BB/9"        val={p.bb9}         good={parseFloat(p.bb9)<2.5}/>
                  <StatBox label="K-BB%"       val={p.kbb}         good={parseFloat(p.kbb)>15} small={true}/>
                  <StatBox label="CSW%"        val={p.csw}         good={parseFloat(p.csw)>30} small={true}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  <StatBox label="HR/9"        val={p.hr9}         good={parseFloat(p.hr9)<1.0} small={true}/>
                  <StatBox label="1st Strike%"  val={p.firstStrike} good={parseFloat(p.firstStrike)>62} small={true}/>
                  <StatBox label="GB%"         val={p.gb}          good={parseFloat(p.gb)>44} small={true}/>
                  <StatBox label="FB%"         val={p.fb}          good={parseFloat(p.fb)<40} small={true}/>
                </div>
              </div>

              <div style={{padding:"10px 12px",background:AGL,
                borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
                <div style={{fontSize:9,fontWeight:800,color:ACCENT,
                  letterSpacing:".1em",marginBottom:4}}>STAT GUIDE</div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                  K-BB% = strikeout% minus walk% — best single measure of pitcher dominance.
                  CSW% = called strikes + whiffs per pitch.
                </div>
              </div>
            </div>
          )}

          {tab==="Splits" && (
            <div>
              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:12}}>HANDEDNESS SPLITS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
                  {[
                    {label:"VS LHH", data:p.splits.vsLHH},
                    {label:"VS RHH", data:p.splits.vsRHH},
                  ].map(function(split) {
                    var eraNum = parseFloat(split.data.era);
                    var eraColor = eraNum<3.5?POS_C:eraNum>4.2?NEG_C:WARN_C;
                    return (
                      <div key={split.label} style={{background:CARD3,borderRadius:12,
                        padding:"14px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:MUTED,fontWeight:700,
                          letterSpacing:".08em",marginBottom:12}}>{split.label}</div>
                        <div style={{fontSize:28,fontWeight:900,color:eraColor,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>
                          {split.data.era}
                        </div>
                        <div style={{fontSize:10,color:MUTED,marginBottom:10}}>ERA</div>
                        <div style={{height:"1px",background:BORDER,marginBottom:10}}/>
                        <div style={{fontSize:18,fontWeight:700,color:TEXT2,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>
                          {split.data.avg}
                        </div>
                        <div style={{fontSize:10,color:MUTED}}>Opp AVG</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:12}}>HOME / AWAY ERA</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[
                    {label:"HOME ERA", val:p.splits.homeEra},
                    {label:"AWAY ERA", val:p.splits.awayEra},
                  ].map(function(s) {
                    var num = parseFloat(s.val);
                    var color = num<3.5?POS_C:num>4.2?NEG_C:WARN_C;
                    return (
                      <div key={s.label} style={{background:CARD3,borderRadius:12,
                        padding:"14px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:MUTED,fontWeight:700,
                          letterSpacing:".08em",marginBottom:12}}>{s.label}</div>
                        <div style={{fontSize:32,fontWeight:900,color:color,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab==="Last 3 Starts" && (
            <div>
              <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
                overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
                  fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
                  RECENT OUTINGS — {p.name.toUpperCase()}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"44px 60px 44px 36px 36px 36px 56px",
                  padding:"7px 14px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
                  {["OPP","DATE","IP","ER","K","BB","Result"].map(function(h) {
                    return (
                      <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                        textAlign:h==="Result"?"center":"left"}}>{h}</div>
                    );
                  })}
                </div>
                {p.last3.map(function(g, i) {
                  var resultColor = g.result==="W"?POS_C:NEG_C;
                  var erBad = g.er>=4;
                  var kGood = g.k>=7;
                  return (
                    <div key={i} style={{display:"grid",
                      gridTemplateColumns:"44px 60px 44px 36px 36px 36px 56px",
                      padding:"11px 14px",alignItems:"center",
                      borderBottom:i<p.last3.length-1?"1px solid "+BORDER:"none",
                      background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                      <div style={{fontSize:12,fontWeight:800,color:TEXT}}>{g.opp}</div>
                      <div style={{fontSize:10,color:MUTED}}>{g.date}</div>
                      <div style={{fontSize:12,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.ip}</div>
                      <div style={{fontSize:12,fontWeight:700,
                        color:erBad?NEG_C:TEXT,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.er}</div>
                      <div style={{fontSize:12,fontWeight:700,
                        color:kGood?POS_C:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.k}</div>
                      <div style={{fontSize:12,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.bb}</div>
                      <div style={{display:"flex",justifyContent:"center"}}>
                        <div style={{width:24,height:24,borderRadius:6,
                          background:resultColor,display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>
                          {g.result}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {label:"Avg K/start",val:p.last3.reduce(function(s,g){return s+g.k;},0)/p.last3.length,
                    good:true},
                  {label:"Avg ER/start",val:p.last3.reduce(function(s,g){return s+g.er;},0)/p.last3.length,
                    good:false},
                  {label:"Avg IP",val:p.avgIP, good:parseFloat(p.avgIP)>=6},
                ].map(function(stat) {
                  var displayVal = typeof stat.val==="number" ?
                    Math.round(stat.val*10)/10 : stat.val;
                  var color = stat.good===true?POS_C:stat.good===false?
                    (parseFloat(displayVal)>=4?NEG_C:WARN_C):TEXT2;
                  return (
                    <div key={stat.label} style={{background:CARD,border:"1px solid "+BORDER,
                      borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:900,color:color,
                        fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>
                        {displayVal}
                      </div>
                      <div style={{fontSize:9,color:MUTED}}>{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab==="vs Lineup" && (
            <div>
              <div style={{padding:"8px 12px",background:CARD,borderRadius:10,
                border:"1px solid "+BORDER,marginBottom:12,
                display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12}}>⚾</span>
                <span style={{fontSize:11,color:TEXT2}}>
                  <span style={{color:TEXT,fontWeight:700}}>{opp.abbr} Lineup</span>
                  {" vs "}
                  <span style={{color:ACCENT,fontWeight:700}}>{p.name}</span>
                </span>
              </div>
              <div style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,overflow:"hidden",marginBottom:12}}>
                <div style={{display:"grid",
                  gridTemplateColumns:"2fr 40px 60px 36px 28px 28px 28px",
                  padding:"8px 12px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
                  {["BATTER","POS","AVG","AB","H","HR","K"].map(function(h) {
                    return (
                      <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                        textAlign:h==="BATTER"?"left":"center"}}>{h}</div>
                    );
                  })}
                </div>
                {p.vsLineup.map(function(batter, i) {
                  var avgNum = parseFloat(batter.avg);
                  var avgColor = avgNum>=0.280?POS_C:avgNum<=0.150?NEG_C:TEXT2;
                  return (
                    <div key={i} style={{display:"grid",
                      gridTemplateColumns:"2fr 40px 60px 36px 28px 28px 28px",
                      padding:"9px 12px",alignItems:"center",
                      borderBottom:i<p.vsLineup.length-1?"1px solid "+BORDER:"none",
                      background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                      <div style={{fontSize:11,fontWeight:600,color:TEXT,
                        textDecoration:"underline",textDecorationColor:TEXT+"44",
                        cursor:"pointer"}}>{batter.name}</div>
                      <div style={{textAlign:"center",fontSize:10,color:MUTED}}>
                        {batter.pos}
                      </div>
                      <div style={{textAlign:"center",fontSize:12,fontWeight:700,
                        color:avgColor,fontFamily:"'IBM Plex Mono',monospace"}}>
                        {batter.avg}
                      </div>
                      <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{batter.ab}</div>
                      <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{batter.h}</div>
                      <div style={{textAlign:"center",fontSize:11,
                        color:batter.hr>0?WARN_C:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{batter.hr}</div>
                      <div style={{textAlign:"center",fontSize:11,
                        color:batter.k>=5?NEG_C:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{batter.k}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{padding:"10px 12px",background:"rgba(251,191,36,.06)",
                border:"1px solid rgba(251,191,36,.15)",borderRadius:10}}>
                <div style={{fontSize:9,fontWeight:800,color:WARN_C,
                  letterSpacing:".1em",marginBottom:4}}>SAMPLE SIZE</div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                  Career matchup data. Low AB counts (under 15) are statistically
                  unreliable — treat as directional only.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view==="Game Stats" && mode==="Bullpen" && (
        <BullpenContent/>
      )}

      {view==="Betting Stats" && mode==="Starters" && (
        <div>
          {(function() {
            var p = spSide==="away" ? PITCHER_STATS.away : PITCHER_STATS.home;
            var tc = TEAM_C[p.abbr] || ACCENT;
            var b = p.bet || {};
            return (
              <div>
                <div style={{background:CARD,border:"2px solid "+tc+"44",
                  borderRadius:14,overflow:"hidden",marginBottom:12}}>
                  <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
                    display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11}}>{p.hot?"🔥":"❄️"}</span>
                    <span style={{fontSize:13,fontWeight:800,color:TEXT}}>
                      {p.name} — Prop Records
                    </span>
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    <div style={{fontSize:9,fontWeight:800,color:MUTED,
                      letterSpacing:".1em",marginBottom:8}}>STRIKEOUT PROPS</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",
                      gap:8,marginBottom:14}}>
                      {[b.k_over, b.k_under].map(function(stat, i) {
                        if(!stat) return null;
                        var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                        var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                                 stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                        var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                                  stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                        return (
                          <div key={i} style={{background:bg,border:"1px solid "+bdr,
                            borderRadius:10,padding:"10px 12px"}}>
                            <div style={{fontSize:9,color:MUTED,marginBottom:4}}>
                              {stat.line}
                            </div>
                            <div style={{fontSize:18,fontWeight:900,color:color,
                              fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                              {stat.rec}
                            </div>
                            <div style={{height:2,background:BORDER2,borderRadius:1,
                              overflow:"hidden",marginBottom:4}}>
                              <div style={{height:"100%",width:stat.pct+"%",
                                background:color,borderRadius:1}}/>
                            </div>
                            <div style={{fontSize:11,fontWeight:700,color:color}}>
                              {stat.pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{fontSize:9,fontWeight:800,color:MUTED,
                      letterSpacing:".1em",marginBottom:8}}>OTHER PROPS</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",
                      gap:8,marginBottom:8}}>
                      {[b.win, b.nrfi, b.outs, b.era].map(function(stat, i) {
                        if(!stat) return null;
                        var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                        var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                                 stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                        var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                                  stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                        return (
                          <div key={i} style={{background:bg,border:"1px solid "+bdr,
                            borderRadius:10,padding:"10px 12px"}}>
                            <div style={{fontSize:9,color:MUTED,marginBottom:4}}>
                              {stat.line}
                            </div>
                            <div style={{fontSize:18,fontWeight:900,color:color,
                              fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                              {stat.rec}
                            </div>
                            <div style={{height:2,background:BORDER2,borderRadius:1,
                              overflow:"hidden",marginBottom:4}}>
                              <div style={{height:"100%",width:stat.pct+"%",
                                background:color,borderRadius:1}}/>
                            </div>
                            <div style={{fontSize:11,fontWeight:700,color:color}}>
                              {stat.pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{padding:"10px 12px",background:AGL,
                  borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
                  <div style={{fontSize:9,fontWeight:800,color:ACCENT,
                    letterSpacing:".1em",marginBottom:4}}>BETTING KEY</div>
                  <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                    Records show W-L on each prop line this season.
                    Green = 60%+ hit rate · Red = 40% or below.
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {view==="Betting Stats" && mode==="Bullpen" && (
        <div style={{padding:"20px",textAlign:"center",color:MUTED,fontSize:12,
          background:CARD,borderRadius:12,border:"1px solid "+BORDER}}>
          Bullpen betting stats coming soon.
        </div>
      )}
    </div>
  );
}


// ── GAME LOG TAB ──────────────────────────────────────────────────────────────
function GameLogTab() {
  var teamArr = useState("BOS");
  var team = teamArr[0]; var setTeam = teamArr[1];
  var sampleArr = useState("10");
  var sample = sampleArr[0]; var setSample = sampleArr[1];
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var sd = team==="BOS" ? SUMMARY_DATA.away : SUMMARY_DATA.home;
  var awayAbbr = GAME_DATA.away.abbr;
  var homeAbbr = GAME_DATA.home.abbr;
  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        {[awayAbbr,homeAbbr].map(function(abbr) {
          var isActive = team===abbr;
          var tc = TEAM_C[abbr] || ACCENT;
          return (
            <button key={abbr} onClick={function(){setTeam(abbr);}}
              style={{padding:"10px",borderRadius:12,fontSize:13,fontWeight:700,
                cursor:"pointer",border:"2px solid "+(isActive?tc:BORDER),
                background:isActive?tc+"22":"transparent",color:isActive?tc:TEXT2}}>
              {abbr}
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10,paddingBottom:4}}>
        {["All Games","5","10","15","30","Season"].map(function(s) {
          var isActive = sample===s;
          return (
            <button key={s} onClick={function(){setSample(s);}}
              style={{padding:"4px 10px",borderRadius:14,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {s}
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,fontWeight:isActive?700:500,
                cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",color:isActive?"#fff":MUTED}}>
              {v}
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {l:"Record",v:sd.record},
          {l:"Win%",v:sd.winPct+"%"},
          {l:"Avg Total",v:sd.avgTotal},
          {l:"R/G",v:sd.avgRG},
        ].map(function(stat) {
          return (
            <div key={stat.l} style={{background:CARD3,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:700,color:TEXT,
                fontFamily:"'IBM Plex Mono',monospace"}}>{stat.v}</div>
              <div style={{fontSize:8,color:MUTED,marginTop:2}}>{stat.l}</div>
            </div>
          );
        })}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:400}}>
          <thead>
            <tr style={{borderBottom:"1px solid "+BORDER}}>
              {["DATE","OPP","W/L","VENUE","RS","RA","AVG","OPS","SP"].map(function(h) {
                return (
                  <th key={h} style={{padding:"6px 4px",textAlign:"left",
                    fontSize:9,fontWeight:700,color:MUTED}}>{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sd.log.map(function(g, i) {
              return (
                <tr key={i} style={{borderBottom:"1px solid "+BORDER}}>
                  <td style={{padding:"6px 4px",color:TEXT2,fontSize:10}}>{g.date}</td>
                  <td style={{padding:"6px 4px",color:TEXT2,fontSize:10}}>{g.opp}</td>
                  <td style={{padding:"6px 4px",fontSize:10,fontWeight:700,
                    color:g.wl==="W"?POS_C:NEG_C}}>{g.wl}</td>
                  <td style={{padding:"6px 4px",color:TEXT2,fontSize:10}}>{g.venue}</td>
                  <td style={{padding:"6px 4px",color:TEXT,fontWeight:600,fontSize:10}}>{g.rs}</td>
                  <td style={{padding:"6px 4px",color:TEXT,fontWeight:600,fontSize:10}}>{g.ra}</td>
                  <td style={{padding:"6px 4px",color:TEXT2,fontSize:10}}>.241</td>
                  <td style={{padding:"6px 4px",color:TEXT2,fontSize:10}}>.712</td>
                  <td style={{padding:"6px 4px",color:TEXT2,fontSize:10}}>{g.sp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BREAKDOWN PAGE ────────────────────────────────────────────────────────────
// ── BALLPARK TAB DATA ─────────────────────────────────────────────────────────
var BALLPARK_DATA = {
  name: "Yankee Stadium",
  location: "Bronx, New York",
  opened: 2009,
  surface: "Grass",
  capacity: 54251,
  roof: "Open Air",
  factors: {
    hr:   {val:121, label:"HR Factor",  icon:"💣", good:true,  note:"Short RF porch (314ft) boosts LHH HR rate"},
    hits: {val:98,  label:"Hit Factor", icon:"🎯", good:false, note:"Large foul territory suppresses BABIP slightly"},
    k:    {val:96,  label:"K Factor",   icon:"⚾", good:false, note:"Hitter-friendly — pitchers slightly less effective"},
    runs: {val:108, label:"Run Factor", icon:"🏃", good:true,  note:"Above-average scoring environment"},
    tb:   {val:112, label:"TB Factor",  icon:"📐", good:true,  note:"Extra-base hit friendly — pull hitters rewarded"},
    bb:   {val:101, label:"BB Factor",  icon:"🚶", good:false, note:"Near league average for walks"},
  },
  dimensions: [
    {loc:"Left Field",   dist:318, x:38,  y:58,  label:"LF", short:true},
    {loc:"Left-Center",  dist:399, x:80,  y:22,  label:"LC", short:false},
    {loc:"Center Field", dist:408, x:150, y:12,  label:"CF", short:false},
    {loc:"Right-Center", dist:385, x:218, y:22,  label:"RC", short:false},
    {loc:"Right Field",  dist:314, x:252, y:58,  label:"RF", short:true},
  ],
  weather: {
    temp:74, condition:"Clear", icon:"☀️",
    wind:{speed:8, dir:"IN", dirFull:"Blowing IN from CF"},
    humidity:58, dewPoint:58, visibility:10,
  },
  historical: [
    {season:"2025",games:81,avgTotal:8.6,overRate:52,hrPerGame:2.1},
    {season:"2024",games:81,avgTotal:9.1,overRate:56,hrPerGame:2.4},
    {season:"2023",games:81,avgTotal:8.8,overRate:54,hrPerGame:2.2},
  ],
  impacts: [
    {bet:"Under 8.5",         direction:"for",     icon:"📉", headline:"Wind IN suppresses HR upside", body:"Wind blowing in at 8mph reduces HR rate at Yankee Stadium by approximately 15%. Balls that would clear the short right porch in calm conditions are held in tonight. With two pitchers projecting a combined ~7 runs, this environmental factor pushes toward the under."},
    {bet:"Cole Over 8.5 K",   direction:"neutral", icon:"⚾", headline:"Park conditions neutral for K props", body:"Strikeout totals are largely unaffected by park factors and wind direction. Cole's K prop is driven by his CSW% and BOS's lineup K rate — not by Yankee Stadium's dimensions. Park factor is effectively a non-issue for this bet."},
    {bet:"Judge Anytime HR",  direction:"against", icon:"💣", headline:"Wind IN hurts HR odds slightly", body:"Despite Yankee Stadium's elevated HR factor (121), tonight's wind blowing IN reduces that advantage by roughly 15%. Judge's raw power can overcome moderate wind, but it's a meaningful headwind compared to calm conditions."},
    {bet:"NYY Money Line",    direction:"for",     icon:"💰", headline:"Home field amplified by park familiarity", body:"NYY's lineup is built for this park — Judge, Soto, and Stanton all benefit from the short right porch. Cole has a 2.11 home ERA vs 3.44 road ERA this season. Home field advantage is real and measurable here."},
    {bet:"NRFI",              direction:"for",     icon:"0️⃣", headline:"Clear conditions favor NRFI", body:"No rain, good visibility, and 74°F create ideal conditions for both starters to execute early. Clear nights at Yankee Stadium show a 71% NRFI rate with elite starters on the mound."},
  ],
};

// ── BALLPARK TAB ──────────────────────────────────────────────────────────────
function BallparkTab() {
  var sectionArr = useState("stadium");
  var section = sectionArr[0]; var setSection = sectionArr[1];
  var bp = BALLPARK_DATA;
  var w = bp.weather;
  var windColor = w.wind.dir==="IN" ? COLD_C : HOT_C;
  var windBg = w.wind.dir==="IN" ? "rgba(125,212,252,.08)" : "rgba(255,107,43,.08)";

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
        padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:15,fontWeight:900,color:TEXT}}>{bp.name}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:2}}>
              {bp.location} · {bp.opened} · {bp.surface} · {bp.roof}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:900,color:ACCENT,
              fontFamily:"'IBM Plex Mono',monospace"}}>
              {bp.capacity.toLocaleString()}
            </div>
            <div style={{fontSize:9,color:MUTED}}>Capacity</div>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
        {[
          ["stadium","🏟 Stadium"],
          ["history","📈 History"],
          ["impact","🎯 Tonight"],
        ].map(function(item) {
          var id = item[0]; var label = item[1];
          var isActive = section===id;
          return (
            <button key={id} onClick={function(){setSection(id);}}
              style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {label}
            </button>
          );
        })}
      </div>

      {section==="stadium" && (
        <div>
          <div style={{background:windBg,border:"1px solid "+windColor+"33",
            borderRadius:14,padding:"14px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",
              justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:28}}>{w.icon}</span>
                <div>
                  <div style={{fontSize:22,fontWeight:900,color:TEXT}}>{w.temp}°F</div>
                  <div style={{fontSize:10,color:TEXT2}}>{w.condition}</div>
                </div>
              </div>
              <div style={{textAlign:"center",padding:"8px 14px",
                background:"rgba(0,0,0,.2)",borderRadius:10,
                border:"1px solid "+windColor+"44"}}>
                <div style={{fontSize:18,fontWeight:900,color:windColor}}>
                  {w.wind.speed} mph
                </div>
                <div style={{fontSize:9,fontWeight:800,color:windColor}}>
                  {w.wind.dir==="IN" ? "⬇ BLOWING IN" : "⬆ BLOWING OUT"}
                </div>
                <div style={{fontSize:8,color:MUTED,marginTop:2}}>{w.wind.dirFull}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[
                {label:"Humidity",val:w.humidity+"%"},
                {label:"Dew Point",val:w.dewPoint+"°F"},
                {label:"Visibility",val:w.visibility+" mi"},
              ].map(function(stat) {
                return (
                  <div key={stat.label} style={{background:"rgba(0,0,0,.2)",
                    borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:TEXT,
                      fontFamily:"'IBM Plex Mono',monospace"}}>{stat.val}</div>
                    <div style={{fontSize:8,color:MUTED,marginTop:1}}>{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>PARK FACTORS (100 = league avg)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
            gap:8,marginBottom:14}}>
            {Object.values(bp.factors).map(function(f) {
              var diff = f.val - 100;
              var valColor = diff > 5 ? (f.good ? POS_C : NEG_C) :
                             diff < -5 ? (f.good ? NEG_C : POS_C) : TEXT2;
              return (
                <div key={f.label} style={{background:CARD,
                  border:"1px solid "+BORDER,borderRadius:12,
                  padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontSize:16,marginBottom:4}}>{f.icon}</div>
                  <div style={{fontSize:18,fontWeight:900,color:valColor,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                    {f.val}
                  </div>
                  <div style={{fontSize:9,fontWeight:600,color:TEXT2,
                    marginBottom:4}}>{f.label}</div>
                  <div style={{fontSize:9,fontWeight:700,
                    color:diff>0?POS_C:diff<0?NEG_C:MUTED}}>
                    {diff>0?"+":""}{diff}%
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>FIELD DIMENSIONS</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:8}}>
            <div style={{position:"relative",width:"100%",height:170,marginBottom:12}}>
              <svg viewBox="0 0 300 170" style={{width:"100%",height:"100%"}}>
                <path d="M 150 165 Q 20 165 25 60 Q 28 25 150 15 Q 272 25 275 60 Q 280 165 150 165 Z"
                  fill="rgba(52,211,153,.06)" stroke={BORDER2} strokeWidth="1.5"/>
                <path d="M 150 165 L 110 125 L 150 85 L 190 125 Z"
                  fill="rgba(255,255,255,.04)" stroke={BORDER2} strokeWidth="1"/>
                <line x1="150" y1="165" x2="25" y2="60"
                  stroke={BORDER2} strokeWidth="1" strokeDasharray="3,3"/>
                <line x1="150" y1="165" x2="275" y2="60"
                  stroke={BORDER2} strokeWidth="1" strokeDasharray="3,3"/>
                <line x1="150" y1="165" x2="150" y2="15"
                  stroke={BORDER2} strokeWidth="1" strokeDasharray="2,4" opacity="0.5"/>
                <circle cx="150" cy="165" r="3" fill={ACCENT}/>
                {bp.dimensions.map(function(d) {
                  return (
                    <g key={d.label}>
                      <text x={d.x} y={d.y} fontSize="10" fontWeight="800"
                        fill={d.short ? WARN_C : TEXT2}
                        textAnchor="middle">{d.label}</text>
                      <text x={d.x} y={d.y+12} fontSize="9"
                        fill={d.short ? WARN_C : COLD_C}
                        textAnchor="middle"
                        fontFamily="'IBM Plex Mono',monospace">{d.dist}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {bp.dimensions.map(function(d) {
                return (
                  <div key={d.label} style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",padding:"6px 10px",
                    background:CARD3,borderRadius:8}}>
                    <span style={{fontSize:10,color:TEXT2}}>{d.loc}</span>
                    <span style={{fontSize:11,fontWeight:700,
                      color:d.short?WARN_C:TEXT,
                      fontFamily:"'IBM Plex Mono',monospace"}}>
                      {d.dist}ft
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>DIMENSION CONTEXT</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              The 314ft RF line is one of the shortest in MLB — a major advantage
              for LHH pull hitters like Judge, Soto and Stanton. CF at 408ft is
              deeper than average, suppressing gap doubles for RHH.
            </div>
          </div>
        </div>
      )}

      {section==="history" && (
        <div>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:10}}>
            HISTORICAL SCORING (LAST 3 SEASONS)
          </div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,overflow:"hidden",marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",
              padding:"8px 14px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
              {["Season","Games","Avg Total","Over%","HR/G"].map(function(h) {
                return (
                  <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                    textAlign:h==="Season"?"left":"center"}}>{h}</div>
                );
              })}
            </div>
            {bp.historical.map(function(row, i) {
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",
                  padding:"11px 14px",
                  borderBottom:i<bp.historical.length-1?"1px solid "+BORDER:"none",
                  background:i===0?AGL:"transparent"}}>
                  <div style={{fontSize:12,fontWeight:700,color:i===0?ACCENT:TEXT2}}>
                    {row.season}{i===0?" ★":""}
                  </div>
                  <div style={{textAlign:"center",fontSize:12,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{row.games}</div>
                  <div style={{textAlign:"center",fontSize:12,fontWeight:600,
                    color:row.avgTotal>=9?NEG_C:row.avgTotal<=8.5?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{row.avgTotal}</div>
                  <div style={{textAlign:"center",fontSize:12,
                    color:row.overRate>=55?NEG_C:row.overRate<=50?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{row.overRate}%</div>
                  <div style={{textAlign:"center",fontSize:12,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{row.hrPerGame}</div>
                </div>
              );
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[
              {label:"3-Year Avg Total",val:"8.8",note:"Tonight's line: 8.5"},
              {label:"3-Year Over Rate",val:"54%",note:"Slight lean toward over historically"},
              {label:"Avg HR/Game",val:"2.2",note:"Wind IN may suppress tonight"},
              {label:"Avg R/Game",val:"4.5",note:"Above MLB avg of 4.3"},
            ].map(function(stat) {
              return (
                <div key={stat.label} style={{background:CARD,
                  border:"1px solid "+BORDER,borderRadius:12,padding:"12px"}}>
                  <div style={{fontSize:11,color:MUTED,marginBottom:4}}>{stat.label}</div>
                  <div style={{fontSize:18,fontWeight:900,color:ACCENT,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{stat.val}</div>
                  <div style={{fontSize:9,color:TEXT2}}>{stat.note}</div>
                </div>
              );
            })}
          </div>
          <div style={{padding:"12px 14px",background:"rgba(52,211,153,.06)",
            border:"1px solid rgba(52,211,153,.15)",borderRadius:12}}>
            <div style={{fontSize:9,fontWeight:800,color:POS_C,
              letterSpacing:".1em",marginBottom:6}}>HISTORICAL CONTEXT</div>
            <div style={{fontSize:11,color:TEXT2,lineHeight:1.7}}>
              Despite Yankee Stadium's elevated HR factor, the 3-year avg total
              of 8.8 is only slightly above tonight's O/U of 8.5. Wind blowing
              IN correlates with unders at this park — under hit at 58% in
              comparable conditions (6-10mph IN).
            </div>
          </div>
        </div>
      )}

      {section==="impact" && (
        <div>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:10}}>
            HOW TONIGHT'S CONDITIONS AFFECT YOUR BETS
          </div>
          {bp.impacts.map(function(item, i) {
            var dirColor = item.direction==="for" ? POS_C :
                           item.direction==="against" ? NEG_C : MUTED;
            var dirBg = item.direction==="for" ? "rgba(52,211,153,.07)" :
                        item.direction==="against" ? "rgba(255,90,90,.07)" :
                        "rgba(255,255,255,.03)";
            var dirBorder = item.direction==="for" ? "rgba(52,211,153,.2)" :
                            item.direction==="against" ? "rgba(255,90,90,.2)" : BORDER;
            var dirLabel = item.direction==="for" ? "v Supports" :
                           item.direction==="against" ? "x Works Against" : "— Neutral";
            return (
              <div key={i} style={{background:dirBg,border:"1px solid "+dirBorder,
                borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:16}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:800,color:TEXT}}>{item.bet}</div>
                    <div style={{fontSize:10,fontWeight:700,color:dirColor}}>{dirLabel}</div>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:4}}>
                  {item.headline}
                </div>
                <div style={{fontSize:11,color:TEXT2,lineHeight:1.7}}>{item.body}</div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}


// ── NFL STUB TAB ──────────────────────────────────────────────────────────────







// ── NFL STADIUM DATA ──────────────────────────────────────────────────────────
var NFL_STADIUM_DATA = {
  name:"Arrowhead Stadium",
  location:"Kansas City, MO",
  surface:"Grass",
  capacity:"76,416",
  type:"Outdoor",
  opened:1972,
  weather:{
    temp:"28°F",
    wind:"12 mph NW",
    conditions:"Partly Cloudy",
    humidity:"44%",
    precip:"0%",
    icon:"🌤",
    impact:"Cold weather (below 30°F) reduces passing efficiency ~8% and scoring by avg 4.2 pts. Under hits 58% in sub-30°F games.",
  },
  surface_detail:{
    type:"Natural Grass",
    condition:"Good",
    footing:"Standard",
    bettingNote:"Natural grass slightly favors run-heavy teams. Footing concerns in cold may affect route running and pursuit angles.",
  },
  crowdNoise:{
    rating:98,
    label:"Elite",
    record:"137.5 dB (world record 2014)",
    impact:"Opponent false starts avg 2.3 per game at Arrowhead — highest in NFL. Away teams convert just 34% on 3rd down here.",
    bettingNote:"Crowd noise creates +2.1 pts home field advantage per Vegas models. Away QBs complete 4.8% fewer passes at Arrowhead.",
  },
  homeEdge:{
    rating:9.2,
    atsHome:"14-4 (78%) — KC last 18 home games vs winning teams",
    ouHome:"Under 58% at Arrowhead this season",
    winPctHome:"82% home win rate last 3 seasons",
    record:"Mahomes 52-12 at Arrowhead in regular season + playoffs",
  },
  history:[
    {season:"2023", homeW:9, homeL:0, homePF:312, homePA:168, ats:"7-2",ou:"U 6-3"},
    {season:"2022", homeW:8, homeL:1, homePF:284, homePA:198, ats:"6-3",ou:"U 5-4"},
    {season:"2021", homeW:7, homeL:2, homePF:268, homePA:188, ats:"5-4",ou:"U 6-3"},
  ],
  bettingImpact:[
    {bet:"KC -3 Cover",    impact:"positive", note:"Home field worth +2.1 pts per Vegas. 78% ATS in home games vs winning teams directly supports the spread."},
    {bet:"Under 47.5",     impact:"positive", note:"Cold weather + elite defenses + Arrowhead's historically low-scoring environment all point under. Under 58% at Arrowhead this season."},
    {bet:"Mahomes Pass Yds",impact:"positive",note:"Crowd noise forces away defense into false starts, creating favorable down-and-distance for Mahomes. Averages 312 pass yds at home."},
    {bet:"Allen Rush Yds", impact:"neutral",  note:"Grass surface is standard. Allen typically scrambles when pocket collapses — KC blitz rate (22%) slightly lower than BUF blitz rate."},
  ],
};


// ── NFL DEFENSE DATA ──────────────────────────────────────────────────────────
var NFL_DEFENSE_STATS = {
  away:{
    abbr:"BUF", name:"Buffalo Bills",
    stats:{
      papg:18.2,  papgRank:3,
      passYpaAllowed:198, passRank:4,
      rushYpaAllowed:98,  rushRank:8,
      sacks:30,   sacksRank:9,
      thirdDown:"34%", thirdRank:5,
      redZone:"48%",   rzRank:6,
      tos:12,     tosRank:11,
      blitzes:"28%",
    },
    last3:[
      {opp:"MIA", pts:17, passYds:218, rushYds:88,  sacks:3, tos:1, result:"W"},
      {opp:"NE",  pts:14, passYds:184, rushYds:74,  sacks:4, tos:2, result:"W"},
      {opp:"LAC", pts:23, passYds:248, rushYds:112, sacks:2, tos:0, result:"L"},
    ],
    keyMatchup:"BUF pass rush (30 sacks) vs KC OL — Mahomes held clean pocket 72% of snaps this season but BUF blitzes at 28% rate.",
    keyDefenders:[
      {name:"Von Miller",    pos:"EDGE", note:"8.5 sacks — elite speed rusher, targets right tackle"},
      {name:"Tremaine Edmunds",pos:"LB", note:"88 tackles, 8 PD — linebacker range limits short routes"},
      {name:"Taron Johnson", pos:"CB",   note:"3 INTs — slot corner that could draw Kelce assignment"},
    ],
    bet:{
      sacks:   {line:"Over 2.5 sacks",  rec:"16-10",pct:62},
      pts:     {line:"Under 24.5 pts allowed",rec:"14-12",pct:54},
      tos:     {line:"Over 0.5 TOs forced",rec:"15-11",pct:58},
      spreadD: {line:"ATS as fav",      rec:"12-5", pct:71},
    },
  },
  home:{
    abbr:"KC",  name:"Kansas City Chiefs",
    stats:{
      papg:19.4,  papgRank:4,
      passYpaAllowed:208, passRank:6,
      rushYpaAllowed:118, rushRank:14,
      sacks:32,   sacksRank:8,
      thirdDown:"36%", thirdRank:8,
      redZone:"44%",   rzRank:9,
      tos:14,     tosRank:8,
      blitzes:"22%",
    },
    last3:[
      {opp:"LV",  pts:13, passYds:194, rushYds:78,  sacks:4, tos:2, result:"W"},
      {opp:"CIN", pts:17, passYds:228, rushYds:88,  sacks:3, tos:1, result:"W"},
      {opp:"LAC", pts:20, passYds:218, rushYds:94,  sacks:2, tos:1, result:"W"},
    ],
    keyMatchup:"KC defense (32 sacks, Spagnuolo scheme) vs Allen's scramble ability — disguised coverages exploit Allen's tendency to force throws under pressure.",
    keyDefenders:[
      {name:"Chris Jones",   pos:"DT",  note:"11 sacks from interior — disrupts passing lanes and run gaps"},
      {name:"Steve Spagnuolo",pos:"DC", note:"Architect of disguised coverages — Allen throws 3 INTs in last 2 vs KC"},
      {name:"Jaylen Watson", pos:"CB",  note:"2 INTs this season — press corner who matches up on slot receivers"},
    ],
    bet:{
      sacks:   {line:"Over 2.5 sacks",     rec:"18-8", pct:69},
      pts:     {line:"Under 28.5 pts allowed",rec:"16-10",pct:62},
      tos:     {line:"Over 0.5 TOs forced", rec:"17-9", pct:65},
      spreadD: {line:"ATS at home",         rec:"14-3", pct:82},
    },
  },
};


// ── NFL RECEIVING DATA ────────────────────────────────────────────────────────
var NFL_RECEIVING_STATS = {
  away:{
    abbr:"BUF",
    players:[
      {name:"Stefon Diggs",  pos:"WR1", hot:true,
       overview:{targets:9, rec:7, yards:84, ypr:12.0, tds:0, long:28, drops:0, airYards:112},
       last3:[
         {opp:"MIA", date:"Jan 5",  tgt:11,rec:8, yds:98, tds:1,result:"W"},
         {opp:"NE",  date:"Dec 29", tgt:8, rec:6, yds:72, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:10,rec:7, yds:84, tds:0,result:"L"},
       ],
       bet:{recYds:{line:"Over 64.5",rec:"17-9", pct:65},
            recs:  {line:"Over 4.5 rec",rec:"18-8",pct:69},
            tds:   {line:"Anytime TD",rec:"9-17",pct:35}}},
      {name:"Gabe Davis",   pos:"WR2", hot:false,
       overview:{targets:6, rec:4, yards:58, ypr:14.5, tds:1, long:34, drops:1, airYards:88},
       last3:[
         {opp:"MIA", date:"Jan 5",  tgt:7, rec:5, yds:72, tds:1,result:"W"},
         {opp:"NE",  date:"Dec 29", tgt:4, rec:2, yds:31, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:6, rec:4, yds:52, tds:0,result:"L"},
       ],
       bet:{recYds:{line:"Over 44.5",rec:"14-12",pct:54},
            recs:  {line:"Over 2.5 rec",rec:"13-13",pct:50},
            tds:   {line:"Anytime TD",rec:"11-15",pct:42}}},
      {name:"Dawson Knox",  pos:"TE",  hot:false,
       overview:{targets:5, rec:4, yards:44, ypr:11.0, tds:1, long:18, drops:0, airYards:54},
       last3:[
         {opp:"MIA", date:"Jan 5",  tgt:6, rec:5, yds:52, tds:1,result:"W"},
         {opp:"NE",  date:"Dec 29", tgt:4, rec:3, yds:38, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:5, rec:3, yds:34, tds:0,result:"L"},
       ],
       bet:{recYds:{line:"Over 34.5",rec:"13-13",pct:50},
            recs:  {line:"Over 2.5 rec",rec:"12-14",pct:46},
            tds:   {line:"Anytime TD",rec:"10-16",pct:38}}},
      {name:"James Cook",   pos:"RB Rec", hot:false,
       overview:{targets:4, rec:3, yards:28, ypr:9.3, tds:0, long:14, drops:0, airYards:24},
       last3:[
         {opp:"MIA", date:"Jan 5",  tgt:5, rec:4, yds:34, tds:0,result:"W"},
         {opp:"NE",  date:"Dec 29", tgt:3, rec:2, yds:18, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:4, rec:3, yds:24, tds:0,result:"L"},
       ],
       bet:{recYds:{line:"Over 18.5",rec:"12-14",pct:46},
            recs:  {line:"Over 2.5 rec",rec:"11-15",pct:42},
            tds:   {line:"Anytime TD",rec:"5-21",pct:19}}},
    ],
    teamStats:{targets:36, rec:28, recYds:312, drops:2, recTds:2, targetRank:8},
  },
  home:{
    abbr:"KC",
    players:[
      {name:"Travis Kelce",   pos:"TE",  hot:true,
       overview:{targets:9, rec:7, yards:84, ypr:12.0, tds:1, long:22, drops:0, airYards:98},
       last3:[
         {opp:"LV",  date:"Jan 5",  tgt:10,rec:8, yds:94, tds:1,result:"W"},
         {opp:"CIN", date:"Dec 29", tgt:8, rec:6, yds:72, tds:1,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:11,rec:9, yds:112,tds:0,result:"W"},
       ],
       bet:{recYds:{line:"Over 54.5",rec:"20-6", pct:77},
            recs:  {line:"Over 4.5 rec",rec:"18-8",pct:69},
            tds:   {line:"Anytime TD",rec:"13-13",pct:50}}},
      {name:"Rashee Rice",    pos:"WR1", hot:true,
       overview:{targets:8, rec:6, yards:72, ypr:12.0, tds:1, long:24, drops:0, airYards:88},
       last3:[
         {opp:"LV",  date:"Jan 5",  tgt:9, rec:7, yds:84, tds:1,result:"W"},
         {opp:"CIN", date:"Dec 29", tgt:7, rec:5, yds:62, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:8, rec:6, yds:74, tds:1,result:"W"},
       ],
       bet:{recYds:{line:"Over 54.5",rec:"16-10",pct:62},
            recs:  {line:"Over 4.5 rec",rec:"15-11",pct:58},
            tds:   {line:"Anytime TD",rec:"12-14",pct:46}}},
      {name:"Marquez Valdes-Scantling",pos:"WR2",hot:false,
       overview:{targets:5, rec:3, yards:48, ypr:16.0, tds:0, long:31, drops:1, airYards:72},
       last3:[
         {opp:"LV",  date:"Jan 5",  tgt:4, rec:2, yds:38, tds:0,result:"W"},
         {opp:"CIN", date:"Dec 29", tgt:5, rec:3, yds:52, tds:1,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:6, rec:4, yds:58, tds:0,result:"W"},
       ],
       bet:{recYds:{line:"Over 34.5",rec:"13-13",pct:50},
            recs:  {line:"Over 2.5 rec",rec:"12-14",pct:46},
            tds:   {line:"Anytime TD",rec:"9-17",pct:35}}},
      {name:"Jerick McKinnon",pos:"RB Rec",hot:false,
       overview:{targets:4, rec:3, yards:24, ypr:8.0, tds:0, long:12, drops:0, airYards:18},
       last3:[
         {opp:"LV",  date:"Jan 5",  tgt:4, rec:3, yds:28, tds:0,result:"W"},
         {opp:"CIN", date:"Dec 29", tgt:3, rec:3, yds:22, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", tgt:5, rec:4, yds:34, tds:1,result:"W"},
       ],
       bet:{recYds:{line:"Over 18.5",rec:"11-15",pct:42},
            recs:  {line:"Over 2.5 rec",rec:"13-13",pct:50},
            tds:   {line:"Anytime TD",rec:"7-19",pct:27}}},
    ],
    teamStats:{targets:36, rec:28, recYds:312, drops:1, recTds:3, targetRank:5},
  },
};


// ── NFL RUSHING DATA ──────────────────────────────────────────────────────────
var NFL_RUSHING_STATS = {
  away:{
    abbr:"BUF",
    players:[
      {name:"James Cook",    pos:"RB1", hot:true,
       overview:{att:18, yards:88, ypc:4.9, tds:1, long:24, fumbles:0, targets:4, rec:3, recYds:28},
       last3:[
         {opp:"MIA", date:"Jan 5",  att:22,yds:112,ypc:5.1,tds:1,result:"W"},
         {opp:"NE",  date:"Dec 29", att:16,yds:74, ypc:4.6,tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", att:14,yds:58, ypc:4.1,tds:0,result:"L"},
       ],
       bet:{rushYds:{line:"Over 74.5",rec:"14-12",pct:54},tds:{line:"Anytime TD",rec:"11-15",pct:42}}},
      {name:"Josh Allen",    pos:"QB Rush", hot:false,
       overview:{att:6, yards:44, ypc:7.3, tds:0, long:18, fumbles:0, targets:0, rec:0, recYds:0},
       last3:[
         {opp:"MIA", date:"Jan 5",  att:5, yds:52, ypc:10.4,tds:1,result:"W"},
         {opp:"NE",  date:"Dec 29", att:4, yds:38, ypc:9.5, tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", att:7, yds:41, ypc:5.9, tds:0,result:"L"},
       ],
       bet:{rushYds:{line:"Over 44.5",rec:"15-11",pct:58},tds:{line:"Anytime Rush TD",rec:"9-17",pct:35}}},
      {name:"Latavius Murray",pos:"RB2", hot:false,
       overview:{att:6, yards:24, ypc:4.0, tds:0, long:9, fumbles:0, targets:2, rec:1, recYds:8},
       last3:[
         {opp:"MIA", date:"Jan 5",  att:4, yds:18, ypc:4.5,tds:0,result:"W"},
         {opp:"NE",  date:"Dec 29", att:5, yds:22, ypc:4.4,tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", att:3, yds:11, ypc:3.7,tds:0,result:"L"},
       ],
       bet:{rushYds:{line:"Over 14.5",rec:"12-14",pct:46},tds:{line:"Anytime TD",rec:"4-22",pct:15}}},
    ],
    teamStats:{rushAtt:30, rushYds:144, ypc:4.8, rushTds:1, rushRank:8, rypgAllowed:98},
  },
  home:{
    abbr:"KC",
    players:[
      {name:"Isiah Pacheco", pos:"RB1", hot:true,
       overview:{att:16, yards:78, ypc:4.9, tds:1, long:21, fumbles:0, targets:3, rec:2, recYds:14},
       last3:[
         {opp:"LV",  date:"Jan 5",  att:18,yds:94, ypc:5.2,tds:1,result:"W"},
         {opp:"CIN", date:"Dec 29", att:14,yds:62, ypc:4.4,tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", att:16,yds:88, ypc:5.5,tds:1,result:"W"},
       ],
       bet:{rushYds:{line:"Over 64.5",rec:"16-10",pct:62},tds:{line:"Anytime TD",rec:"13-13",pct:50}}},
      {name:"P. Mahomes",    pos:"QB Rush", hot:true,
       overview:{att:4, yards:28, ypc:7.0, tds:0, long:14, fumbles:0, targets:0, rec:0, recYds:0},
       last3:[
         {opp:"LV",  date:"Jan 5",  att:3, yds:22, ypc:7.3,tds:0,result:"W"},
         {opp:"CIN", date:"Dec 29", att:4, yds:31, ypc:7.8,tds:1,result:"W"},
         {opp:"LAC", date:"Dec 22", att:5, yds:38, ypc:7.6,tds:0,result:"W"},
       ],
       bet:{rushYds:{line:"Over 24.5",rec:"14-12",pct:54},tds:{line:"Anytime Rush TD",rec:"8-18",pct:31}}},
      {name:"Jerick McKinnon",pos:"RB2", hot:false,
       overview:{att:5, yards:18, ypc:3.6, tds:0, long:8, fumbles:0, targets:4, rec:3, recYds:22},
       last3:[
         {opp:"LV",  date:"Jan 5",  att:3, yds:12, ypc:4.0,tds:0,result:"W"},
         {opp:"CIN", date:"Dec 29", att:4, yds:14, ypc:3.5,tds:0,result:"W"},
         {opp:"LAC", date:"Dec 22", att:3, yds:9,  ypc:3.0,tds:0,result:"W"},
       ],
       bet:{rushYds:{line:"Over 14.5",rec:"10-16",pct:38},tds:{line:"Anytime TD",rec:"5-21",pct:19}}},
    ],
    teamStats:{rushAtt:25, rushYds:124, ypc:5.0, rushTds:1, rushRank:12, rypgAllowed:118},
  },
};



// ── NFL PLAYER PAGE DATA ──────────────────────────────────────────────────────
var NFL_PLAYER_PAGES = {
  "Josh Allen": {
    name:"Josh Allen", team:"BUF", pos:"QB", hot:false,
    headlineStat:"284 Pass Yds/G · 94.8 Rating",
    season:{comp:"63.2%",yds:284,tds:2,ints:1,rating:94.8,rushYds:44,rushTds:0},
    tonightEdge:{
      oppRank:"KC Pass Defense: #6 in NFL",
      propLine:"Pass Yds Over/Under 284.5",
      rec:"15-11",pct:58,
      lean:"Slight lean OVER — KC allows 208 pass yds/g but Allen averages more on road",
      risk:"Allen has thrown 3 INTs in last 2 vs KC — turnover risk is real",
    },
    recentForm:[
      {opp:"MIA", date:"Jan 5",  comp:"22/31",yds:312,tds:3,ints:0,rating:118.4,result:"W"},
      {opp:"NE",  date:"Dec 29", comp:"19/28",yds:241,tds:1,ints:1,rating:84.2, result:"W"},
      {opp:"LAC", date:"Dec 22", comp:"21/34",yds:284,tds:2,ints:2,rating:82.1, result:"L"},
      {opp:"DAL", date:"Dec 15", comp:"24/36",yds:298,tds:3,ints:0,rating:108.4,result:"W"},
      {opp:"IND", date:"Dec 8",  comp:"20/31",yds:271,tds:2,ints:1,rating:92.1, result:"W"},
      {opp:"PHI", date:"Dec 1",  comp:"18/29",yds:241,tds:1,ints:2,rating:74.2, result:"L"},
      {opp:"MIA", date:"Nov 17", comp:"23/34",yds:291,tds:2,ints:0,rating:104.1,result:"W"},
      {opp:"IND", date:"Nov 10", comp:"21/32",yds:268,tds:2,ints:1,rating:94.8, result:"W"},
      {opp:"NYJ", date:"Nov 3",  comp:"24/34",yds:302,tds:3,ints:0,rating:114.2,result:"W"},
      {opp:"SEA", date:"Oct 27", comp:"19/31",yds:258,tds:1,ints:1,rating:84.1, result:"W"},
    ],
    propRecord:[
      {line:"Pass Yds Over 284.5", rec:"15-11", pct:58},
      {line:"Over 1.5 TD passes",  rec:"14-12", pct:54},
      {line:"Over 0.5 INTs",       rec:"12-14", pct:46},
      {line:"Over 21.5 completions",rec:"16-10",pct:62},
      {line:"Rush Yds Over 44.5",  rec:"15-11", pct:58},
    ],
    bestOpponents:[
      {opp:"MIA", games:4, avgYds:308, avgTds:2.8, rating:112.4},
      {opp:"IND", games:3, avgYds:298, avgTds:2.7, rating:108.1},
      {opp:"NYJ", games:4, avgYds:291, avgTds:2.5, rating:104.8},
    ],
    worstOpponents:[
      {opp:"KC",  games:6, avgYds:241, avgTds:1.2, rating:78.4},
      {opp:"PHI", games:3, avgYds:248, avgTds:1.4, rating:82.1},
      {opp:"NE",  games:4, avgYds:254, avgTds:1.6, rating:84.8},
    ],
    bestVenues:[
      {venue:"Highmark Stadium",   avgYds:312, avgTds:2.8, rating:108.4},
      {venue:"Hard Rock Stadium",  avgYds:304, avgTds:2.6, rating:104.1},
      {venue:"MetLife Stadium",    avgYds:298, avgTds:2.4, rating:101.8},
    ],
    worstVenues:[
      {venue:"Arrowhead Stadium",  avgYds:238, avgTds:1.1, rating:74.2},
      {venue:"Lincoln Financial",  avgYds:244, avgTds:1.3, rating:79.8},
      {venue:"Gillette Stadium",   avgYds:251, avgTds:1.5, rating:82.4},
    ],
    careerVsTonight:{
      opp:"KC", games:6,
      avgYds:241, avgTds:1.2, avgInts:1.8, rating:78.4,
      log:[
        {season:"2024", date:"Jan 5",  yds:198, tds:1, ints:2, result:"L"},
        {season:"2024", date:"Oct 6",  yds:262, tds:2, ints:1, result:"W"},
        {season:"2023", date:"AFC CG", yds:241, tds:1, ints:3, result:"L"},
        {season:"2023", date:"Oct 16", yds:215, tds:0, ints:2, result:"L"},
        {season:"2022", date:"Jan 23", yds:329, tds:4, ints:0, result:"W"},
        {season:"2022", date:"Oct 16", yds:213, tds:1, ints:2, result:"L"},
      ],
    },
  },
  "Isiah Pacheco": {
    name:"Isiah Pacheco", team:"KC", pos:"RB", hot:true,
    headlineStat:"78 Rush Yds/G · 4.9 YPC",
    season:{att:16,yds:78,ypc:4.9,tds:1,long:21,rec:2,recYds:14,fumbles:0},
    tonightEdge:{
      oppRank:"BUF Rush Defense: #8 in NFL",
      propLine:"Rush Yds Over/Under 64.5",
      rec:"16-10",pct:62,
      lean:"Lean OVER — KC leans run game at home, Pacheco averages 88 rush yds at Arrowhead",
      risk:"BUF allows just 98 rush yds/g — top 10 rush defense is a real headwind",
    },
    recentForm:[
      {opp:"LV",  date:"Jan 5",  att:18, yds:94,  ypc:5.2, tds:1, result:"W"},
      {opp:"CIN", date:"Dec 29", att:14, yds:62,  ypc:4.4, tds:0, result:"W"},
      {opp:"LAC", date:"Dec 22", att:16, yds:88,  ypc:5.5, tds:1, result:"W"},
      {opp:"NE",  date:"Dec 15", att:18, yds:104, ypc:5.8, tds:1, result:"W"},
      {opp:"GB",  date:"Dec 8",  att:14, yds:58,  ypc:4.1, tds:0, result:"W"},
      {opp:"LV",  date:"Dec 1",  att:12, yds:48,  ypc:4.0, tds:0, result:"W"},
      {opp:"CAR", date:"Nov 24", att:19, yds:112, ypc:5.9, tds:2, result:"W"},
      {opp:"BUF", date:"Nov 17", att:14, yds:44,  ypc:3.1, tds:0, result:"L"},
      {opp:"DEN", date:"Nov 10", att:17, yds:88,  ypc:5.2, tds:1, result:"W"},
      {opp:"TB",  date:"Nov 3",  att:15, yds:72,  ypc:4.8, tds:1, result:"W"},
    ],
    propRecord:[
      {line:"Rush Yds Over 64.5",  rec:"16-10", pct:62},
      {line:"Anytime TD",          rec:"13-13", pct:50},
      {line:"Rush Att Over 14.5",  rec:"17-9",  pct:65},
      {line:"Rec Yds Over 14.5",   rec:"12-14", pct:46},
    ],
    bestOpponents:[
      {opp:"NE",  games:3, avgYds:102, avgTds:1.3, ypc:5.6},
      {opp:"LV",  games:4, avgYds:94,  avgTds:1.1, ypc:5.2},
      {opp:"CAR", games:2, avgYds:98,  avgTds:1.5, ypc:5.8},
    ],
    worstOpponents:[
      {opp:"BUF", games:3, avgYds:44,  avgTds:0.3, ypc:3.1},
      {opp:"PHI", games:2, avgYds:52,  avgTds:0.5, ypc:3.4},
      {opp:"BAL", games:2, avgYds:54,  avgTds:0.5, ypc:3.6},
    ],
    bestVenues:[
      {venue:"Arrowhead Stadium",  avgYds:88,  avgTds:1.2, ypc:5.1},
      {venue:"Allegiant Stadium",  avgYds:94,  avgTds:1.1, ypc:5.3},
      {venue:"Bank of America",    avgYds:98,  avgTds:1.4, ypc:5.6},
    ],
    worstVenues:[
      {venue:"Highmark Stadium",   avgYds:44,  avgTds:0.3, ypc:3.1},
      {venue:"Lincoln Financial",  avgYds:52,  avgTds:0.5, ypc:3.4},
      {venue:"M&T Bank Stadium",   avgYds:54,  avgTds:0.5, ypc:3.6},
    ],
    careerVsTonight:{
      opp:"BUF", games:3,
      avgYds:44, avgTds:0.3, ypc:3.1,
      log:[
        {season:"2024", date:"Nov 17", yds:44,  tds:0, ypc:3.1, result:"L"},
        {season:"2023", date:"Oct 16", yds:38,  tds:1, ypc:3.5, result:"W"},
        {season:"2023", date:"Jan 21", yds:51,  tds:0, ypc:2.8, result:"L"},
      ],
    },
  },
  "Travis Kelce": {
    name:"Travis Kelce", team:"KC", pos:"TE", hot:true,
    headlineStat:"84 Rec Yds/G · 7.0 Rec/G",
    season:{targets:9,rec:7,yds:84,ypr:12.0,tds:1,long:22,drops:0},
    tonightEdge:{
      oppRank:"BUF TE Defense: #22 in NFL",
      propLine:"Rec Yds Over/Under 54.5",
      rec:"20-6",pct:77,
      lean:"Strong lean OVER — BUF ranks 22nd vs TEs, Kelce averages 74 rec yds at Arrowhead",
      risk:"BUF slot corner Taron Johnson shadowed Kelce in previous meetings — watch injury report",
    },
    recentForm:[
      {opp:"LV",  date:"Jan 5",  tgt:10, rec:8, yds:94,  tds:1, result:"W"},
      {opp:"CIN", date:"Dec 29", tgt:8,  rec:6, yds:72,  tds:1, result:"W"},
      {opp:"LAC", date:"Dec 22", tgt:11, rec:9, yds:112, tds:0, result:"W"},
      {opp:"NE",  date:"Dec 15", tgt:9,  rec:7, yds:84,  tds:1, result:"W"},
      {opp:"GB",  date:"Dec 8",  tgt:7,  rec:5, yds:58,  tds:0, result:"W"},
      {opp:"LV",  date:"Dec 1",  tgt:8,  rec:6, yds:68,  tds:1, result:"W"},
      {opp:"CAR", date:"Nov 24", tgt:10, rec:8, yds:98,  tds:2, result:"W"},
      {opp:"BUF", date:"Nov 17", tgt:6,  rec:4, yds:38,  tds:0, result:"L"},
      {opp:"DEN", date:"Nov 10", tgt:9,  rec:7, yds:74,  tds:1, result:"W"},
      {opp:"TB",  date:"Nov 3",  tgt:8,  rec:6, yds:64,  tds:0, result:"W"},
    ],
    propRecord:[
      {line:"Rec Yds Over 54.5",  rec:"20-6",  pct:77},
      {line:"Over 4.5 receptions",rec:"18-8",  pct:69},
      {line:"Anytime TD",         rec:"13-13", pct:50},
      {line:"Over 64.5 rec yds",  rec:"16-10", pct:62},
    ],
    bestOpponents:[
      {opp:"LV",  games:6, avgRec:7.8, avgYds:94,  avgTds:1.2},
      {opp:"DEN", games:6, avgRec:7.2, avgYds:88,  avgTds:1.1},
      {opp:"NE",  games:4, avgRec:7.0, avgYds:84,  avgTds:1.0},
    ],
    worstOpponents:[
      {opp:"BUF", games:6, avgRec:4.2, avgYds:41,  avgTds:0.3},
      {opp:"BAL", games:4, avgRec:4.8, avgYds:48,  avgTds:0.5},
      {opp:"PHI", games:3, avgRec:5.1, avgYds:52,  avgTds:0.7},
    ],
    bestVenues:[
      {venue:"Arrowhead Stadium",  avgYds:88,  avgRec:7.4, avgTds:1.1},
      {venue:"Allegiant Stadium",  avgYds:94,  avgRec:7.8, avgTds:1.2},
      {venue:"Mile High Stadium",  avgYds:84,  avgRec:7.1, avgTds:1.0},
    ],
    worstVenues:[
      {venue:"Highmark Stadium",   avgYds:41,  avgRec:4.2, avgTds:0.3},
      {venue:"M&T Bank Stadium",   avgYds:48,  avgRec:4.8, avgTds:0.5},
      {venue:"Lincoln Financial",  avgYds:52,  avgRec:5.1, avgTds:0.7},
    ],
    careerVsTonight:{
      opp:"BUF", games:6,
      avgYds:41, avgRec:4.2, avgTds:0.3,
      log:[
        {season:"2024", date:"Nov 17", rec:4, yds:38,  tds:0, result:"L"},
        {season:"2024", date:"Jan 21", rec:5, yds:44,  tds:1, result:"W"},
        {season:"2023", date:"Oct 16", rec:3, yds:28,  tds:0, result:"W"},
        {season:"2023", date:"Jan 29", rec:6, yds:54,  tds:0, result:"W"},
        {season:"2022", date:"Oct 16", rec:4, yds:34,  tds:0, result:"L"},
        {season:"2022", date:"Jan 23", rec:3, yds:25,  tds:1, result:"W"},
      ],
    },
  },
};


// ── NFL PASSING DATA ──────────────────────────────────────────────────────────
var NFL_PASSING_STATS = {
  away:{
    name:"Josh Allen", abbr:"BUF", hot:false,
    overview:{
      comp:"63.2%", att:34, yards:284, tds:2, ints:1,
      rating:94.8, sacks:2, scrambles:4,
    },
    advanced:{
      airYards:8.4, yac:3.2, adot:9.1, pressure:"38%",
      cpoe:"+2.1%", badThrow:"12%", dropRate:"4%",
      redZone:"4-7", thirdDown:"58%", twoMinute:"3-4",
    },
    last3:[
      {opp:"MIA", date:"Jan 5",  comp:"22/31",yds:312,tds:3,ints:0,rating:118.4,result:"W"},
      {opp:"NE",  date:"Dec 29", comp:"19/28",yds:241,tds:1,ints:1,rating:84.2, result:"W"},
      {opp:"LAC", date:"Dec 22", comp:"21/34",yds:284,tds:2,ints:2,rating:82.1, result:"L"},
    ],
    bet:{
      passYds:{line:"Over/Under 284.5",rec:"15-11",pct:58,over_pct:58},
      tds:    {line:"Over 1.5 TDs",    rec:"14-12",pct:54,over_pct:54},
      ints:   {line:"Over 0.5 INTs",   rec:"12-14",pct:46,over_pct:46},
      completions:{line:"Over 21.5",   rec:"16-10",pct:62,over_pct:62},
    },
  },
  home:{
    name:"P. Mahomes", abbr:"KC", hot:true,
    overview:{
      comp:"68.2%", att:36, yards:312, tds:3, ints:0,
      rating:108.4, sacks:1, scrambles:3,
    },
    advanced:{
      airYards:9.1, yac:4.1, adot:10.2, pressure:"28%",
      cpoe:"+5.4%", badThrow:"8%", dropRate:"3%",
      redZone:"6-9", thirdDown:"68%", twoMinute:"4-4",
    },
    last3:[
      {opp:"LV",  date:"Jan 5",  comp:"24/34",yds:298,tds:3,ints:0,rating:118.8,result:"W"},
      {opp:"CIN", date:"Dec 29", comp:"21/32",yds:284,tds:2,ints:0,rating:104.2,result:"W"},
      {opp:"LAC", date:"Dec 22", comp:"26/38",yds:312,tds:3,ints:1,rating:101.4,result:"W"},
    ],
    bet:{
      passYds:{line:"Over/Under 284.5",rec:"19-7",pct:73,over_pct:73},
      tds:    {line:"Over 2.5 TDs",    rec:"16-10",pct:62,over_pct:62},
      ints:   {line:"Under 0.5 INTs",  rec:"20-6", pct:77,over_pct:23},
      completions:{line:"Over 23.5",   rec:"18-8", pct:69,over_pct:69},
    },
  },
};


// ── NFL SUMMARY DATA ──────────────────────────────────────────────────────────
var NFL_SUMMARY_DATA = {
  away:{
    abbr:"BUF", record:"11-6", winPct:65, coverPct:54,
    ppg:24.1, papg:18.2, passYpg:268, rushYpg:112, totalYpg:380,
    passYpaAllowed:218, rushYpaAllowed:98, totalYpaAllowed:316,
    sacks:30, tos:12, thirdDown:"42%", redZone:"58%",
    form:["W","L","W","W","L"],
    bet:{
      ml:       {rec:"11-6",  pct:65, label:"Money Line"},
      spread:   {rec:"17-17", pct:50, label:"ATS"},
      over:     {rec:"18-17", pct:51, label:"Over"},
      under:    {rec:"17-18", pct:49, label:"Under"},
      f1h_ml:   {rec:"10-7",  pct:59, label:"1H Money Line"},
      f1h_under:{rec:"15-12", pct:56, label:"1H Under"},
      f1h_over: {rec:"12-15", pct:44, label:"1H Over"},
      td_over:  {rec:"13-14", pct:48, label:"Team TD Over"},
    },
    log:[
      {date:"Jan 5", opp:"MIA", wl:"W", pts:31, opp_pts:17, pass:312, rush:88,  ats:"W", ou:"O"},
      {date:"Dec 29",opp:"NE",  wl:"W", pts:24, opp_pts:14, pass:241, rush:102, ats:"W", ou:"U"},
      {date:"Dec 22",opp:"LAC", wl:"L", pts:20, opp_pts:23, pass:284, rush:78,  ats:"L", ou:"U"},
      {date:"Dec 15",opp:"DAL", wl:"W", pts:31, opp_pts:10, pass:298, rush:118, ats:"W", ou:"U"},
      {date:"Dec 8", opp:"IND", wl:"W", pts:28, opp_pts:25, pass:271, rush:94,  ats:"L", ou:"O"},
    ],
  },
  home:{
    abbr:"KC",  record:"11-6", winPct:65, coverPct:57,
    ppg:31.4, papg:19.4, passYpg:284, rushYpg:98, totalYpg:382,
    passYpaAllowed:198, rushYpaAllowed:118, totalYpaAllowed:316,
    sacks:32, tos:14, thirdDown:"48%", redZone:"68%",
    form:["W","W","W","L","W"],
    bet:{
      ml:       {rec:"11-6",  pct:65, label:"Money Line"},
      spread:   {rec:"21-16", pct:57, label:"ATS"},
      over:     {rec:"20-17", pct:54, label:"Over"},
      under:    {rec:"17-20", pct:46, label:"Under"},
      f1h_ml:   {rec:"13-4",  pct:76, label:"1H Money Line"},
      f1h_under:{rec:"14-13", pct:52, label:"1H Under"},
      f1h_over: {rec:"13-14", pct:48, label:"1H Over"},
      td_over:  {rec:"16-11", pct:59, label:"Team TD Over"},
    },
    log:[
      {date:"Jan 5", opp:"LV",  wl:"W", pts:31, opp_pts:13, pass:298, rush:112, ats:"W", ou:"U"},
      {date:"Dec 29",opp:"CIN", wl:"W", pts:24, opp_pts:17, pass:284, rush:88,  ats:"W", ou:"U"},
      {date:"Dec 22",opp:"LAC", wl:"W", pts:28, opp_pts:20, pass:312, rush:94,  ats:"W", ou:"O"},
      {date:"Dec 15",opp:"NE",  wl:"L", pts:17, opp_pts:21, pass:241, rush:78,  ats:"L", ou:"U"},
      {date:"Dec 8", opp:"GB",  wl:"W", pts:27, opp_pts:19, pass:271, rush:104, ats:"W", ou:"U"},
    ],
  },
};


// ── NFL TRENDS DATA ───────────────────────────────────────────────────────────
var NFL_TRENDS_DATA = [
  {cat:"Form",    hot:true,  icon:"🔥",
   title:"KC 9-2 at home, 6-1 last 7",
   body:"Kansas City is rolling at Arrowhead — 9-2 overall at home this season with a +116 point differential. In their last 7 home games they have covered the spread 5 times. Mahomes has posted a 112.4 passer rating in those wins."},
  {cat:"Form",    hot:true,  icon:"🔥",
   title:"BUF 4-1 in last 5 road games",
   body:"Buffalo has been strong on the road lately, going 4-1 with Josh Allen posting 300+ passing yards in 3 of those 5 outings. Their road offense ranks 4th in the NFL over the last 5 weeks at 29.2 PPG."},
  {cat:"Form",    hot:false, icon:"❄️",
   title:"BUF 1-3 ATS last 4 vs elite defenses",
   body:"When facing top-10 defenses in points allowed, Buffalo has struggled to cover. Allen's turnover rate increases against elite secondaries — 4 interceptions in last 3 games vs top defenses."},
  {cat:"H2H",     hot:true,  icon:"📊",
   title:"KC 8-4 all-time vs BUF including playoffs",
   body:"Kansas City leads the all-time series 8-4 including a 2-0 playoff record over Buffalo. In the last 6 regular season meetings, KC has won 4 with Mahomes posting a 101.4 average passer rating."},
  {cat:"H2H",     hot:true,  icon:"📊",
   title:"Under 5-2 in last 7 KC vs BUF meetings",
   body:"The total has gone under in 5 of the last 7 meetings between these teams regardless of the posted total. Both coaching staffs emphasize ball control and field position in high-stakes matchups."},
  {cat:"H2H",     hot:false, icon:"📊",
   title:"BUF covered in 3 of last 4 at Arrowhead",
   body:"Despite losing 3 of those 4 games outright, Buffalo has covered the spread in 3 of their last 4 trips to Arrowhead Stadium. The games have been competitive — average margin of defeat just 4.3 points."},
  {cat:"Offense", hot:true,  icon:"🏈",
   title:"Mahomes 312 pass yds avg at home",
   body:"Patrick Mahomes averages 312 passing yards in home games this season — up from his 284 road average. The Arrowhead crowd creates false start penalties that create favorable down-and-distance situations for the KC offense."},
  {cat:"Offense", hot:true,  icon:"🏈",
   title:"Kelce 74 rec yds avg at home — well above 54.5 line",
   body:"Travis Kelce is averaging 74 receiving yards in home games this season, comfortably above his 54.5 prop line. BUF ranked 22nd in TE receiving yards allowed — a clear mismatch tonight."},
  {cat:"Offense", hot:false, icon:"❄️",
   title:"Allen 3 INTs in last 2 games vs KC",
   body:"Josh Allen has thrown 3 interceptions in his last 2 games against Kansas City. Steve Spagnuolo's defense consistently creates confusion with disguised coverages that exploit Allen's tendency to force throws."},
  {cat:"Defense", hot:true,  icon:"🛡",
   title:"KC defense 4th in points allowed (19.4 PPG)",
   body:"Kansas City's defense has been elite this season, ranking 4th in the NFL in points allowed at 19.4 PPG. Their pass rush generates pressure on 38% of opposing dropbacks — significantly above league average."},
  {cat:"Defense", hot:true,  icon:"🛡",
   title:"BUF defense 3rd in points allowed (18.2 PPG)",
   body:"Buffalo's defense has been equally impressive at 18.2 PPG allowed. Their secondary led by Taron Johnson has allowed the lowest completion percentage in the AFC over the last 6 weeks at 57.8%."},
  {cat:"Defense", hot:false, icon:"❄️",
   title:"BUF allows 14th most QB rush yards in NFL",
   body:"Kansas City should scheme designed QB runs for Mahomes. BUF ranks 14th in QB rush yards allowed — Spagnuolo may dial up designed runs to keep the defense honest and open up play action."},
  {cat:"Betting", hot:true,  icon:"💰",
   title:"Sharp money on KC -3 — line moved from -2.5",
   body:"The line opened KC -2.5 and has moved to -3 against public opinion (68% on BUF). Reverse line movement of this magnitude signals significant sharp action on Kansas City. This is one of the clearest sharp signals of the week."},
  {cat:"Betting", hot:true,  icon:"💰",
   title:"Under 58% in comparable weather games",
   body:"In games with temperatures below 32°F this season, totals have gone under at a 58% rate. With 28°F forecast at Arrowhead, the weather factor adds meaningful support to the under 47.5."},
  {cat:"Betting", hot:false, icon:"❄️",
   title:"Public 68% on BUF — contrarian angle favors KC",
   body:"Heavy public action on Buffalo creates a contrarian opportunity on Kansas City. When 65%+ of public money backs one side, fading the public has been profitable at 54% against the spread this season."},
  {cat:"Situational",hot:true,icon:"⚡",
   title:"KC 8-1 in primetime games this season",
   body:"Kansas City is 8-1 in games with national TV exposure this season. The Chiefs consistently elevate their performance in high-profile spots — Mahomes' passer rating in primetime games is 114.2 vs 102.8 in non-primetime."},
  {cat:"Situational",hot:false,icon:"❄️",
   title:"BUF 2-4 in cold weather games below 30°F",
   body:"Buffalo has gone just 2-4 in games played below 30°F this season despite their supposed cold weather advantage. Allen's completion percentage drops 4.8% in extreme cold, affecting his timing routes."},
  {cat:"Injuries", hot:false, icon:"🏥",
   title:"BUF CB1 Tre'Davious White questionable",
   body:"Buffalo's top cornerback is listed questionable entering this game. If White is limited or out, BUF loses their best cover defender against Kelce in the slot and Hill on the outside, directly benefiting KC's passing attack."},
];


function NFLStubTab(props) {
  var label = props.label;
  return (
    <div style={{padding:"40px 20px",textAlign:"center",animation:"fadeUp .2s ease"}}>
      <div style={{fontSize:24,marginBottom:12}}>🏈</div>
      <div style={{fontSize:14,fontWeight:700,color:TEXT,marginBottom:6}}>{label}</div>
      <div style={{fontSize:11,color:MUTED}}>Coming in next update</div>
    </div>
  );
}

// ── NFL MATCHUP OVERVIEW ──────────────────────────────────────────────────────
function NFLMatchupOverview(props) {
  var onOpenSummary = props.onOpenSummary;
  var g = NFL_GAME;
  var awayC = NFL_TEAM_C[g.away.abbr] || ACCENT;
  var homeC = NFL_TEAM_C[g.home.abbr] || ACCENT;
  return (
    <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
      padding:"12px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10}}>🤖</span>
          <span style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
            MATCHUP OVERVIEW
          </span>
        </div>
        <button onClick={onOpenSummary}
          style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
            borderRadius:10,background:POS_C+"18",border:"1px solid "+POS_C+"33",
            cursor:"pointer"}}>
          <span style={{fontSize:9}}>📊</span>
          <span style={{fontSize:10,fontWeight:700,color:POS_C}}>Game Summary</span>
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,marginBottom:12,alignItems:"center"}}>
        <div style={{background:CARD3,borderRadius:12,padding:"12px",
          border:"2px solid "+awayC+"44",textAlign:"center"}}>
          <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{g.away.abbr} QB</div>
          <div style={{fontSize:13,fontWeight:800,color:awayC,marginBottom:6}}>
            {g.away.qb}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[["Rating",g.away.qbRating],[],[],[]].slice(0,1).map(function(s) {
              return (
                <div key={s[0]} style={{background:CARD,borderRadius:8,padding:"6px 4px",
                  gridColumn:"span 2",textAlign:"center"}}>
                  <div style={{fontSize:9,color:MUTED,marginBottom:2}}>QB Rating</div>
                  <div style={{fontSize:18,fontWeight:900,
                    color:g.away.qbRating>=100?POS_C:g.away.qbRating>=90?WARN_C:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.away.qbRating}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:12,color:MUTED,fontWeight:700}}>@</div>
          <div style={{fontSize:10,fontWeight:700,color:TEXT,marginTop:4}}>{g.spread}</div>
          <div style={{fontSize:9,color:MUTED}}>O/U {g.total}</div>
        </div>
        <div style={{background:CARD3,borderRadius:12,padding:"12px",
          border:"2px solid "+homeC+"44",textAlign:"center"}}>
          <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{g.home.abbr} QB</div>
          <div style={{fontSize:13,fontWeight:800,color:homeC,marginBottom:6}}>
            {g.home.qb}
            {g.home.qbHot && <span style={{fontSize:10,marginLeft:4}}>🔥</span>}
          </div>
          <div style={{background:CARD,borderRadius:8,padding:"6px 4px",textAlign:"center"}}>
            <div style={{fontSize:9,color:MUTED,marginBottom:2}}>QB Rating</div>
            <div style={{fontSize:18,fontWeight:900,
              color:g.home.qbRating>=100?POS_C:g.home.qbRating>=90?WARN_C:NEG_C,
              fontFamily:"'IBM Plex Mono',monospace"}}>{g.home.qbRating}</div>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
        {g.context.map(function(c) {
          return (
            <div key={c.label} style={{textAlign:"center",padding:"6px 4px",
              background:CARD3,borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:800,color:c.color,
                fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{c.val}</div>
              <div style={{fontSize:8,color:MUTED}}>{c.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── NFL SIGNAL INFO MODAL ─────────────────────────────────────────────────────
function NFLSignalInfoModal(props) {
  var f = props.f;
  var onClose = props.onClose;
  if(!f) return null;
  var isPos = f.score > 0;
  var color = isPos ? POS_C : NEG_C;
  var bg = isPos ? "rgba(52,211,153,.06)" : "rgba(255,90,90,.06)";
  var border = isPos ? "rgba(52,211,153,.18)" : "rgba(255,90,90,.18)";
  return (
    <div style={{position:"fixed",inset:0,zIndex:600,
      background:"rgba(0,0,0,.82)",backdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:CARD2,border:"1px solid "+BORDER2,
          borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
          maxHeight:"80vh",overflowY:"auto",
          padding:"22px 18px 36px",animation:"fadeUp .2s ease"}}>
        <div style={{display:"flex",alignItems:"flex-start",
          justifyContent:"space-between",marginBottom:16}}>
          <div style={{flex:1,marginRight:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:26,height:26,borderRadius:8,background:color+"22",
                border:"1px solid "+color+"44",display:"flex",alignItems:"center",
                justifyContent:"center"}}>
                <span style={{fontSize:13,color:color,fontWeight:800}}>
                  {isPos?"v":"x"}
                </span>
              </div>
              <span style={{fontSize:14,fontWeight:800,color:TEXT}}>{f.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,fontWeight:700,color:color,
                padding:"2px 10px",borderRadius:10,background:color+"18"}}>
                {isPos?"Supporting":"Risk Factor"}
              </span>
              <span style={{fontSize:10,color:MUTED}}>Weight {f.weight}/10</span>
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid "+BORDER,
              borderRadius:8,width:28,height:28,color:TEXT2,
              cursor:"pointer",fontSize:14,flexShrink:0}}>x</button>
        </div>
        <div style={{background:bg,border:"1px solid "+border,
          borderRadius:14,padding:"14px 16px"}}>
          <div style={{fontSize:9,fontWeight:800,color:color,
            letterSpacing:".1em",marginBottom:10}}>WHY THIS MATTERS FOR THIS BET</div>
          <div style={{fontSize:12,color:TEXT2,lineHeight:1.8}}>
            {f.why||"This factor contributes to the overall confidence score."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NFL FULL EDGE CARD ────────────────────────────────────────────────────────
function NFLEdgeCard(props) {
  var edge = props.edge;
  var onInfo = props.onInfo;
  var openArr = useState(false);
  var open = openArr[0]; var setOpen = openArr[1];
  var sectionArr = useState("analysis");
  var section = sectionArr[0]; var setSection = sectionArr[1];
  var catColor = edge.type==="spread"?POS_C:edge.type==="total"?ACCENT:
                 edge.type==="ml"?POS_C:WARN_C;
  var catLabel = edge.type==="spread"?"Spread":edge.type==="total"?"Total":
                 edge.type==="ml"?"Money Line":"Player Prop";
  var gradeColor = edge.grade==="A"||edge.grade==="A-"?POS_C:ACCENT;
  var posF = (edge.factors||[]).filter(function(f){return f.score>0;}).length;
  var negF = (edge.factors||[]).filter(function(f){return f.score<0;}).length;
  return (
    <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:14,
      marginBottom:8,overflow:"hidden"}}>
      <div onClick={function(){setOpen(!open);}} style={{padding:"12px 14px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
            <span style={{fontSize:16,flexShrink:0}}>{edge.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:TEXT,overflow:"hidden",
              textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{edge.bet}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:900,color:gradeColor}}>{edge.grade}</div>
              <div style={{fontSize:8,color:MUTED}}>Grade</div>
            </div>
            <span style={{color:TEXT2,fontSize:11}}>{open?"▲":"▼"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
          {edge.team && (
            <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
              background:(NFL_TEAM_C[edge.team]||ACCENT)+"22",
              color:NFL_TEAM_C[edge.team]||ACCENT}}>{edge.team}</span>
          )}
          <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
            background:catColor+"22",border:"1px solid "+catColor+"44",color:catColor}}>
            {catLabel}
          </span>
        </div>
        <ConfBar pct={edge.conf}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
          <span style={{fontSize:10,color:POS_C,fontWeight:600}}>
            {edge.supporting} supporting factors
          </span>
          <span style={{fontSize:10,color:MUTED,fontFamily:"'IBM Plex Mono',monospace"}}>
            {edge.line}
          </span>
        </div>
      </div>
      {open && (
        <div style={{borderTop:"1px solid "+BORDER}}>
          <div style={{display:"flex",borderBottom:"1px solid "+BORDER}}>
            {[["analysis","📋 Analysis"],["signals","📡 Signals"],["lines","📖 Lines"]].map(function(item) {
              var id=item[0]; var label=item[1];
              var isActive=section===id;
              return (
                <button key={id} onClick={function(e){e.stopPropagation();setSection(id);}}
                  style={{flex:1,padding:"8px 4px",fontSize:10,fontWeight:600,
                    cursor:"pointer",border:"none",
                    background:isActive?CARD2:"transparent",color:isActive?TEXT:MUTED,
                    borderBottom:isActive?"2px solid "+catColor:"2px solid transparent"}}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{padding:"12px 14px"}}>
            {section==="analysis" && (
              <div>
                <div style={{fontSize:11,color:TEXT2,lineHeight:1.7,marginBottom:10}}>
                  {edge.analysis}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Sample Line</div>
                    <div style={{fontSize:11,fontWeight:800,color:ACCENT,
                      fontFamily:"'IBM Plex Mono',monospace"}}>{edge.line}</div>
                  </div>
                  <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Alt Play</div>
                    <div style={{fontSize:10,fontWeight:600,color:TEXT2,lineHeight:1.3}}>
                      {edge.altPlay}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:9,fontWeight:800,color:POS_C,
                  letterSpacing:".1em",marginBottom:8}}>SUPPORTING EVIDENCE</div>
                {edge.bullets.map(function(b,i) {
                  return (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",
                      gap:6,marginBottom:5}}>
                      <span style={{color:POS_C,fontSize:10,marginTop:1,flexShrink:0}}>•</span>
                      <span style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>{b}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {section==="signals" && (
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                  {[[POS_C,"Supporting",posF],[NEG_C,"Risk",negF]].map(function(item) {
                    return (
                      <div key={item[1]} style={{textAlign:"center",padding:"8px 6px",
                        background:CARD3,borderRadius:10}}>
                        <div style={{fontSize:16,fontWeight:800,color:item[0]}}>{item[2]}</div>
                        <div style={{fontSize:9,color:MUTED}}>{item[1]}</div>
                      </div>
                    );
                  })}
                </div>
                {(edge.factors||[]).map(function(f,i) {
                  var fc = f.score>0?POS_C:f.score<0?NEG_C:MUTED;
                  return (
                    <div key={i} style={{background:CARD3,borderRadius:10,
                      padding:"10px 12px",marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",
                        justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:9,color:fc,fontWeight:800}}>
                            {f.score>0?"v":"x"}
                          </span>
                          <span style={{fontSize:11,fontWeight:600,color:TEXT}}>
                            {f.label}
                          </span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:9,color:MUTED}}>Wt {f.weight}</span>
                          <button onClick={function(){onInfo(f);}}
                            style={{width:18,height:18,borderRadius:"50%",
                              background:ACCENT+"22",border:"1px solid "+ACCENT+"44",
                              fontSize:9,color:ACCENT,cursor:"pointer",
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                            i
                          </button>
                        </div>
                      </div>
                      <div style={{height:2,background:BORDER2,borderRadius:1,overflow:"hidden"}}>
                        <div style={{height:"100%",width:(f.weight*10)+"%",
                          background:fc,borderRadius:1}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {section==="lines" && (
              <div>
                <div style={{padding:"10px 12px",background:CARD3,borderRadius:10,marginBottom:8}}>
                  <div style={{fontSize:9,color:MUTED,marginBottom:4}}>Sample Line</div>
                  <div style={{fontSize:14,fontWeight:800,color:ACCENT,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{edge.line}</div>
                </div>
                {edge.altPlay && (
                  <div style={{padding:"10px 12px",background:CARD3,borderRadius:10}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:4}}>Alt Play</div>
                    <div style={{fontSize:12,fontWeight:700,color:TEXT2}}>{edge.altPlay}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NFL PARLAY BUILDER ────────────────────────────────────────────────────────
function NFLParlayBuilder() {
  var legsArr = useState(3);
  var legs = legsArr[0]; var setLegs = legsArr[1];
  var typesArr = useState(["spread","ou","td","pass","rush","rec"]);
  var activeTypes = typesArr[0]; var setActiveTypes = typesArr[1];

  var combos = NFL_PARLAY_COMBOS[legs] || [];
  return (
    <div>
      <div style={{background:AGL,border:"1px solid rgba(77,159,255,.2)",
        borderRadius:12,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:ACCENT,marginBottom:4}}>
          🏦 Parlay Builder
        </div>
        <div style={{fontSize:11,color:TEXT2,lineHeight:1.5}}>
          EdgeView assembles the best NFL parlay combinations from tonight's highest-confidence edges.
        </div>
      </div>
      <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",marginBottom:8}}>
        NUMBER OF LEGS
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[2,3,4,5].map(function(n) {
          var isActive=legs===n;
          return (
            <button key={n} onClick={function(){setLegs(n);}}
              style={{flex:1,padding:"10px 4px",borderRadius:14,fontSize:12,fontWeight:700,
                cursor:"pointer",border:"2px solid "+(isActive?ACCENT:BORDER),
                background:isActive?ACCENT+"22":"transparent",
                color:isActive?ACCENT:TEXT2}}>
              {n}-Leg
            </button>
          );
        })}
      </div>
      <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em",marginBottom:8}}>
        BET TYPES
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {NFL_BET_TYPE_OPTS.map(function(bt) {
          var isActive=activeTypes.indexOf(bt.id)>-1;
          return (
            <button key={bt.id}
              onClick={function(){
                if(isActive){setActiveTypes(activeTypes.filter(function(t){return t!==bt.id;}));}
                else{setActiveTypes(activeTypes.concat([bt.id]));}
              }}
              style={{padding:"5px 10px",borderRadius:20,fontSize:10,fontWeight:600,
                cursor:"pointer",display:"flex",alignItems:"center",gap:4,
                background:isActive?ACCENT+"22":"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?ACCENT:TEXT2}}>
              <span style={{fontSize:11}}>{bt.icon}</span>{bt.label}
            </button>
          );
        })}
      </div>
      {combos.map(function(combo,i) {
        var isTop=i===0;
        return (
          <div key={i} style={{background:isTop?CARD2:CARD,
            border:"1px solid "+(isTop?WARN_C+"44":BORDER),
            borderRadius:14,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",
              justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {isTop&&<span style={{fontSize:12}}>🏆</span>}
                <span style={{fontSize:12,fontWeight:800,color:isTop?WARN_C:TEXT}}>
                  {combo.label}
                </span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:900,color:ACCENT,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{combo.odds}</div>
                <div style={{fontSize:9,color:MUTED}}>Est. odds</div>
              </div>
            </div>
            <div style={{fontSize:9,color:MUTED,marginBottom:10}}>
              {legs}-leg · {combo.prob}% combined probability
            </div>
            {combo.legs.map(function(leg,j) {
              return (
                <div key={j} style={{background:CARD3,borderRadius:10,
                  padding:"8px 12px",marginBottom:6,fontSize:11,
                  fontWeight:600,color:TEXT}}>
                  {leg}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── NFL ANALYSIS TAB ──────────────────────────────────────────────────────────







function NFLStadiumTab() {
  var sectionArr = useState("Stadium");
  var section = sectionArr[0]; var setSection = sectionArr[1];
  var sd = NFL_STADIUM_DATA;
  var tc = NFL_TEAM_C["KC"] || ACCENT;

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
        {["Stadium","Weather","Home Edge","History","Bet Impact"].map(function(s) {
          var isActive = section===s;
          return (
            <button key={s} onClick={function(){setSection(s);}}
              style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {s}
            </button>
          );
        })}
      </div>

      {section==="Stadium" && (
        <div>
          <div style={{background:CARD,border:"2px solid "+tc+"44",
            borderRadius:14,padding:"14px",marginBottom:12}}>
            <div style={{fontSize:16,fontWeight:900,color:TEXT,marginBottom:4}}>
              🏟 {sd.name}
            </div>
            <div style={{fontSize:11,color:MUTED,marginBottom:12}}>
              {sd.location}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[
                {label:"Surface",  val:sd.surface},
                {label:"Type",     val:sd.type},
                {label:"Capacity", val:sd.capacity},
                {label:"Opened",   val:sd.opened},
              ].map(function(s) {
                return (
                  <div key={s.label} style={{background:CARD3,borderRadius:10,
                    padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{s.label}</div>
                    <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{s.val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{background:CARD3,borderRadius:10,padding:"12px"}}>
              <div style={{fontSize:9,fontWeight:800,color:MUTED,
                letterSpacing:".1em",marginBottom:6}}>SURFACE CONDITION</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:700,color:TEXT}}>
                  {sd.surface_detail.type}
                </span>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",
                  borderRadius:10,background:POS_C+"22",
                  border:"1px solid "+POS_C+"44",color:POS_C}}>
                  {sd.surface_detail.condition}
                </span>
              </div>
              <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                {sd.surface_detail.bettingNote}
              </div>
            </div>
          </div>
          <div style={{background:"rgba(231,24,55,.06)",
            border:"1px solid rgba(231,24,55,.2)",
            borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:9,fontWeight:800,color:tc,
              letterSpacing:".1em",marginBottom:6}}>🔊 CROWD NOISE</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{flex:1,height:6,background:BORDER2,
                borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:sd.crowdNoise.rating+"%",
                  background:tc,borderRadius:3}}/>
              </div>
              <span style={{fontSize:14,fontWeight:900,color:tc,
                fontFamily:"'IBM Plex Mono',monospace",minWidth:32}}>
                {sd.crowdNoise.rating}
              </span>
              <span style={{fontSize:11,fontWeight:700,color:tc}}>
                {sd.crowdNoise.label}
              </span>
            </div>
            <div style={{fontSize:9,color:MUTED,marginBottom:6}}>
              {sd.crowdNoise.record}
            </div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5,marginBottom:8}}>
              {sd.crowdNoise.impact}
            </div>
            <div style={{padding:"8px 10px",background:"rgba(0,0,0,.2)",
              borderRadius:8,fontSize:10,color:WARN_C,lineHeight:1.5}}>
              💰 {sd.crowdNoise.bettingNote}
            </div>
          </div>
        </div>
      )}

      {section==="Weather" && (
        <div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <span style={{fontSize:40}}>{sd.weather.icon}</span>
              <div>
                <div style={{fontSize:28,fontWeight:900,color:TEXT}}>
                  {sd.weather.temp}
                </div>
                <div style={{fontSize:12,color:MUTED}}>{sd.weather.conditions}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[
                {label:"Wind",     val:sd.weather.wind},
                {label:"Humidity", val:sd.weather.humidity},
                {label:"Precip",   val:sd.weather.precip},
                {label:"Surface",  val:sd.surface},
              ].map(function(s) {
                return (
                  <div key={s.label} style={{background:CARD3,borderRadius:10,
                    padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{s.label}</div>
                    <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{s.val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:"10px 12px",background:"rgba(251,191,36,.06)",
              border:"1px solid rgba(251,191,36,.15)",borderRadius:10}}>
              <div style={{fontSize:9,fontWeight:800,color:WARN_C,
                letterSpacing:".1em",marginBottom:4}}>⚠️ WEATHER IMPACT</div>
              <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>{sd.weather.impact}</div>
            </div>
          </div>
        </div>
      )}

      {section==="Home Edge" && (
        <div>
          <div style={{background:CARD,border:"2px solid "+tc+"44",
            borderRadius:14,padding:"14px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",
              justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:800,color:TEXT}}>
                Home Field Rating
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:24,fontWeight:900,color:POS_C,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{sd.homeEdge.rating}</div>
                <div style={{fontSize:9,color:MUTED}}>out of 10</div>
              </div>
            </div>
            <div style={{height:6,background:BORDER2,borderRadius:3,
              overflow:"hidden",marginBottom:14}}>
              <div style={{height:"100%",width:(sd.homeEdge.rating*10)+"%",
                background:POS_C,borderRadius:3}}/>
            </div>
            {[
              {label:"ATS at Home",    val:sd.homeEdge.atsHome},
              {label:"O/U at Home",    val:sd.homeEdge.ouHome},
              {label:"Home Win Rate",  val:sd.homeEdge.winPctHome},
              {label:"Mahomes Record", val:sd.homeEdge.record},
            ].map(function(s) {
              return (
                <div key={s.label} style={{padding:"10px 0",
                  borderBottom:"1px solid "+BORDER}}>
                  <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{s.label}</div>
                  <div style={{fontSize:11,fontWeight:700,color:TEXT,lineHeight:1.4}}>
                    {s.val}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section==="History" && (
        <div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
              fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
              ARROWHEAD — HOME RECORD BY SEASON
            </div>
            <div style={{display:"grid",
              gridTemplateColumns:"52px 44px 44px 52px 52px 40px 56px",
              padding:"7px 12px",background:CARD3,
              borderBottom:"1px solid "+BORDER}}>
              {["Season","W","L","PF","PA","ATS","O/U"].map(function(h){
                return (<div key={h} style={{fontSize:9,fontWeight:700,
                  color:MUTED,textAlign:"center"}}>{h}</div>);
              })}
            </div>
            {sd.history.map(function(s, i) {
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"52px 44px 44px 52px 52px 40px 56px",
                  padding:"10px 12px",alignItems:"center",
                  borderBottom:i<sd.history.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <div style={{textAlign:"center",fontSize:10,color:MUTED}}>{s.season}</div>
                  <div style={{textAlign:"center",fontSize:12,fontWeight:700,color:POS_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{s.homeW}</div>
                  <div style={{textAlign:"center",fontSize:12,color:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{s.homeL}</div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{s.homePF}</div>
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{s.homePA}</div>
                  <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:POS_C}}>
                    {s.ats}
                  </div>
                  <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:ACCENT}}>
                    {s.ou}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section==="Bet Impact" && (
        <div>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:10}}>
            HOW ARROWHEAD AFFECTS TONIGHT'S BETS
          </div>
          {sd.bettingImpact.map(function(item, i) {
            var impColor = item.impact==="positive"?POS_C:
                           item.impact==="negative"?NEG_C:MUTED;
            var impBg = item.impact==="positive"?"rgba(52,211,153,.06)":
                        item.impact==="negative"?"rgba(255,90,90,.06)":
                        "rgba(255,255,255,.03)";
            var impBdr = item.impact==="positive"?"rgba(52,211,153,.2)":
                         item.impact==="negative"?"rgba(255,90,90,.2)":BORDER;
            return (
              <div key={i} style={{background:impBg,border:"1px solid "+impBdr,
                borderRadius:14,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:12,color:impColor,fontWeight:800}}>
                    {item.impact==="positive"?"↑":item.impact==="negative"?"↓":"→"}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,color:TEXT}}>{item.bet}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                    borderRadius:10,background:impColor+"22",
                    border:"1px solid "+impColor+"44",color:impColor,marginLeft:"auto"}}>
                    {item.impact==="positive"?"Supports":"Neutral"}
                  </span>
                </div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.6}}>{item.note}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function NFLDefenseTab() {
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var sideArr = useState("away");
  var side = sideArr[0]; var setSide = sideArr[1];

  var team = side==="away" ? NFL_DEFENSE_STATS.away : NFL_DEFENSE_STATS.home;
  var tc = NFL_TEAM_C[team.abbr] || ACCENT;

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,
                fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",
                color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {["away","home"].map(function(s) {
          var ds = s==="away" ? NFL_DEFENSE_STATS.away : NFL_DEFENSE_STATS.home;
          var ptc = NFL_TEAM_C[ds.abbr] || ACCENT;
          var isActive = side===s;
          return (
            <button key={s} onClick={function(){setSide(s);}}
              style={{padding:"10px",borderRadius:12,cursor:"pointer",
                border:"2px solid "+(isActive?ptc:BORDER),
                background:isActive?ptc+"22":"transparent",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{ds.abbr}</div>
              <div style={{fontSize:13,fontWeight:800,
                color:isActive?ptc:TEXT}}>Defense</div>
            </button>
          );
        })}
      </div>

      {view==="Game Stats" && (
        <div>
          <div style={{background:CARD,border:"2px solid "+tc+"44",
            borderRadius:14,padding:"14px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:12}}>
              {team.abbr} DEFENSIVE UNIT
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",
              gap:8,marginBottom:8}}>
              {[
                {label:"Pts Allowed/G", val:team.stats.papg,
                  rank:team.stats.papgRank,  good:team.stats.papgRank<=5},
                {label:"Pass Yds/G",    val:team.stats.passYpaAllowed,
                  rank:team.stats.passRank,  good:team.stats.passRank<=5},
                {label:"Rush Yds/G",    val:team.stats.rushYpaAllowed,
                  rank:team.stats.rushRank,  good:team.stats.rushRank<=8},
                {label:"Sacks",         val:team.stats.sacks,
                  rank:team.stats.sacksRank, good:team.stats.sacksRank<=10},
                {label:"3rd Down Stop%",val:team.stats.thirdDown,
                  rank:team.stats.thirdRank, good:team.stats.thirdRank<=8},
                {label:"Red Zone Def%", val:team.stats.redZone,
                  rank:team.stats.rzRank,    good:team.stats.rzRank<=8},
                {label:"Turnovers",     val:team.stats.tos,
                  rank:team.stats.tosRank,   good:team.stats.tosRank<=10},
                {label:"Blitz Rate",    val:team.stats.blitzes,
                  rank:null,             good:null},
              ].map(function(s) {
                var rankColor = s.rank
                  ? s.rank<=5?POS_C:s.rank<=10?ACCENT:s.rank<=20?WARN_C:NEG_C
                  : TEXT2;
                var valColor = s.good===true?POS_C:s.good===false?NEG_C:TEXT2;
                return (
                  <div key={s.label} style={{background:CARD3,borderRadius:10,
                    padding:"10px 12px",display:"flex",alignItems:"center",
                    justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:900,color:valColor,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
                    </div>
                    {s.rank && (
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Rank</div>
                        <div style={{fontSize:14,fontWeight:800,color:rankColor,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{"#"+s.rank}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:10}}>LAST 3 GAMES</div>
            <div style={{display:"grid",
              gridTemplateColumns:"44px 36px 58px 58px 40px 36px",
              padding:"6px 8px",background:CARD3,borderRadius:8,marginBottom:6}}>
              {["OPP","PTS","PASS","RUSH","SCK","TO"].map(function(h){
                return (<div key={h} style={{fontSize:8,fontWeight:700,
                  color:MUTED,textAlign:"center"}}>{h}</div>);
              })}
            </div>
            {team.last3.map(function(g, i) {
              var ptsColor = g.pts<=17?POS_C:g.pts>=28?NEG_C:TEXT2;
              var resultColor = g.result==="W"?POS_C:NEG_C;
              return (
                <div key={i} style={{display:"grid",
                  gridTemplateColumns:"44px 36px 58px 58px 40px 36px",
                  padding:"9px 8px",alignItems:"center",
                  borderBottom:i<team.last3.length-1?"1px solid "+BORDER:"none",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,color:TEXT}}>
                    {g.opp}
                  </div>
                  <div style={{textAlign:"center",fontSize:12,fontWeight:800,
                    color:ptsColor,fontFamily:"'IBM Plex Mono',monospace"}}>{g.pts}</div>
                  <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.passYds}</div>
                  <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.rushYds}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.sacks>=3?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.sacks}</div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.tos>=1?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.tos}</div>
                </div>
              );
            })}
          </div>

          <div style={{background:"rgba(251,191,36,.06)",
            border:"1px solid rgba(251,191,36,.18)",
            borderRadius:14,padding:"14px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:WARN_C,
              letterSpacing:".1em",marginBottom:8}}>🎯 KEY MATCHUP TONIGHT</div>
            <div style={{fontSize:11,color:TEXT2,lineHeight:1.7,marginBottom:12}}>
              {team.keyMatchup}
            </div>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:8}}>KEY DEFENDERS TO WATCH</div>
            {team.keyDefenders.map(function(d, i) {
              return (
                <div key={i} style={{display:"flex",alignItems:"flex-start",
                  gap:10,padding:"8px 0",
                  borderBottom:i<team.keyDefenders.length-1
                    ?"1px solid "+BORDER:"none"}}>
                  <div style={{flexShrink:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:TEXT}}>
                      {d.name}
                    </div>
                    <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                      borderRadius:6,background:ACCENT+"22",
                      border:"1px solid "+ACCENT+"44",color:ACCENT}}>
                      {d.pos}
                    </span>
                  </div>
                  <div style={{fontSize:10,color:TEXT2,lineHeight:1.5,flex:1}}>
                    {d.note}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>RANKING CONTEXT</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              Rankings out of 32 NFL teams · Green = top 5 · Blue = top 10 ·
              Yellow = middle · Red = bottom 10
            </div>
          </div>
        </div>
      )}

      {view==="Betting Stats" && (
        <div>
          <div style={{background:CARD,border:"2px solid "+tc+"44",
            borderRadius:14,overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER}}>
              <div style={{fontSize:13,fontWeight:800,color:TEXT}}>
                {team.abbr} Defense — Prop Records
              </div>
            </div>
            <div style={{padding:"12px 14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                {[team.bet.sacks, team.bet.pts, team.bet.tos, team.bet.spreadD].map(function(stat, i) {
                  if(!stat) return null;
                  var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                  var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                           stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                  var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                            stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                  return (
                    <div key={i} style={{background:bg,border:"1px solid "+bdr,
                      borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:MUTED,marginBottom:4,lineHeight:1.3}}>
                        {stat.line}
                      </div>
                      <div style={{fontSize:18,fontWeight:900,color:color,
                        fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                        {stat.rec}
                      </div>
                      <div style={{height:2,background:BORDER2,borderRadius:1,
                        overflow:"hidden",marginBottom:4}}>
                        <div style={{height:"100%",width:stat.pct+"%",
                          background:color,borderRadius:1}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:color}}>{stat.pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>BETTING KEY</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              Records show W-L on prop line this season.
              Green = 60%+ · Red = 40% or below.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function NFLReceivingTab(props) {
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var sideArr = useState("away");
  var side = sideArr[0]; var setSide = sideArr[1];
  var expandArr = useState(null);
  var expand = expandArr[0]; var setExpand = expandArr[1];

  var onSelectPlayer = props.onSelectPlayer;
  var team = side==="away" ? NFL_RECEIVING_STATS.away : NFL_RECEIVING_STATS.home;
  var tc = NFL_TEAM_C[team.abbr] || ACCENT;

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);setExpand(null);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,
                fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",
                color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {["away","home"].map(function(s) {
          var rs = s==="away" ? NFL_RECEIVING_STATS.away : NFL_RECEIVING_STATS.home;
          var ptc = NFL_TEAM_C[rs.abbr] || ACCENT;
          var isActive = side===s;
          return (
            <button key={s} onClick={function(){setSide(s);setExpand(null);}}
              style={{padding:"10px",borderRadius:12,cursor:"pointer",
                border:"2px solid "+(isActive?ptc:BORDER),
                background:isActive?ptc+"22":"transparent",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{rs.abbr}</div>
              <div style={{fontSize:13,fontWeight:800,
                color:isActive?ptc:TEXT}}>Pass Attack</div>
            </button>
          );
        })}
      </div>

      {view==="Game Stats" && (
        <div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:10}}>
              {team.abbr} TEAM RECEIVING
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {label:"Targets",   val:team.teamStats.targets,  good:team.teamStats.targets>=32},
                {label:"Rec",       val:team.teamStats.rec,       good:team.teamStats.rec>=26},
                {label:"Rec Yds",   val:team.teamStats.recYds,    good:team.teamStats.recYds>=280},
                {label:"Rec TDs",   val:team.teamStats.recTds,    good:team.teamStats.recTds>=2},
                {label:"Drops",     val:team.teamStats.drops,     good:team.teamStats.drops===0},
                {label:"Tgt Rank",  val:"#"+team.teamStats.targetRank,good:team.teamStats.targetRank<=8},
              ].map(function(s) {
                var c = s.good ? POS_C : s.label==="Drops"&&team.teamStats.drops>0?NEG_C:TEXT2;
                return (
                  <div key={s.label} style={{background:CARD3,borderRadius:10,
                    padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:14,fontWeight:800,color:c,
                      fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{s.val}</div>
                    <div style={{fontSize:8,color:MUTED}}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>RECEIVING BREAKDOWN</div>

          {team.players.map(function(p, i) {
            var isExpanded = expand===p.name;
            var posColor = p.pos==="WR1"?POS_C:p.pos==="TE"?ACCENT:
                           p.pos==="WR2"?WARN_C:MUTED;
            return (
              <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,marginBottom:8,overflow:"hidden"}}>
                <div onClick={function(){setExpand(isExpanded?null:p.name);}}
                  style={{padding:"12px 14px",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {p.hot && <span style={{fontSize:10}}>🔥</span>}
                      <div>
                        <div onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                          style={{fontSize:13,fontWeight:700,color:TEXT,
                            cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                            textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                            textDecorationColor:ACCENT+"66"}}>{p.name}</div>
                        <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                          borderRadius:6,background:posColor+"22",
                          border:"1px solid "+posColor+"44",color:posColor}}>
                          {p.pos}
                        </span>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:16,fontWeight:900,color:TEXT,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{p.overview.yards}</div>
                        <div style={{fontSize:8,color:MUTED}}>Rec Yds</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:12,fontWeight:700,color:ACCENT,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{p.overview.rec}/{p.overview.targets}</div>
                        <div style={{fontSize:8,color:MUTED}}>Rec/Tgt</div>
                      </div>
                      <span style={{color:TEXT2,fontSize:11}}>{isExpanded?"▲":"▼"}</span>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:4}}>
                    {[
                      {l:"TGT",  v:p.overview.targets},
                      {l:"REC",  v:p.overview.rec},
                      {l:"YPR",  v:p.overview.ypr},
                      {l:"TDs",  v:p.overview.tds,  hot:p.overview.tds>0},
                      {l:"DRP",  v:p.overview.drops, bad:p.overview.drops>0},
                    ].map(function(s) {
                      var c = s.hot?POS_C:s.bad&&s.v>0?NEG_C:TEXT2;
                      return (
                        <div key={s.l} style={{textAlign:"center",padding:"4px 2px",
                          background:CARD3,borderRadius:6}}>
                          <div style={{fontSize:11,fontWeight:700,color:c,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{s.v}</div>
                          <div style={{fontSize:7,color:MUTED}}>{s.l}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{borderTop:"1px solid "+BORDER,padding:"12px 14px"}}>
                    <div style={{fontSize:9,fontWeight:800,color:MUTED,
                      letterSpacing:".1em",marginBottom:8}}>LAST 3 GAMES</div>
                    <div style={{display:"grid",
                      gridTemplateColumns:"44px 60px 36px 36px 44px 36px",
                      padding:"6px 8px",background:CARD3,borderRadius:8,marginBottom:6}}>
                      {["OPP","DATE","TGT","REC","YDS","TD"].map(function(h){
                        return (<div key={h} style={{fontSize:8,fontWeight:700,
                          color:MUTED,textAlign:"center"}}>{h}</div>);
                      })}
                    </div>
                    {p.last3.map(function(g, j) {
                      var ydsColor = g.yds>=70?POS_C:g.yds<40?NEG_C:TEXT2;
                      return (
                        <div key={j} style={{display:"grid",
                          gridTemplateColumns:"44px 60px 36px 36px 44px 36px",
                          padding:"8px",alignItems:"center",
                          borderBottom:j<p.last3.length-1?"1px solid "+BORDER+"66":"none"}}>
                          <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:TEXT}}>{g.opp}</div>
                          <div style={{textAlign:"center",fontSize:9,color:MUTED}}>{g.date}</div>
                          <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.tgt}</div>
                          <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.rec}</div>
                          <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                            color:ydsColor,fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                          <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                            color:g.tds>0?POS_C:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view==="Betting Stats" && (
        <div>
          {team.players.map(function(p, i) {
            var posColor = p.pos==="WR1"?POS_C:p.pos==="TE"?ACCENT:
                           p.pos==="WR2"?WARN_C:MUTED;
            return (
              <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  {p.hot && <span style={{fontSize:10}}>🔥</span>}
                  <span onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                  style={{fontSize:13,fontWeight:700,color:TEXT,
                    cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                    textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                    textDecorationColor:ACCENT+"66"}}>{p.name}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                    borderRadius:6,background:posColor+"22",
                    border:"1px solid "+posColor+"44",color:posColor}}>
                    {p.pos}
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[p.bet.recYds, p.bet.recs, p.bet.tds].map(function(stat, j) {
                    if(!stat) return null;
                    var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                    var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                             stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                    var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                              stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                    return (
                      <div key={j} style={{background:bg,border:"1px solid "+bdr,
                        borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                        <div style={{fontSize:9,color:MUTED,marginBottom:4,lineHeight:1.3}}>
                          {stat.line}
                        </div>
                        <div style={{fontSize:16,fontWeight:900,color:color,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                          {stat.rec}
                        </div>
                        <div style={{height:2,background:BORDER2,borderRadius:1,
                          overflow:"hidden",marginBottom:4}}>
                          <div style={{height:"100%",width:stat.pct+"%",
                            background:color,borderRadius:1}}/>
                        </div>
                        <div style={{fontSize:11,fontWeight:700,color:color}}>{stat.pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>BETTING KEY</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              Records show W-L on prop line this season.
              Green = 60%+ · Red = 40% or below.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function NFLRushingTab(props) {
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var sideArr = useState("away");
  var side = sideArr[0]; var setSide = sideArr[1];
  var expandArr = useState(null);
  var expand = expandArr[0]; var setExpand = expandArr[1];

  var onSelectPlayer = props.onSelectPlayer;
  var team = side==="away" ? NFL_RUSHING_STATS.away : NFL_RUSHING_STATS.home;
  var tc = NFL_TEAM_C[team.abbr] || ACCENT;

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);setExpand(null);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,
                fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",
                color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {["away","home"].map(function(s) {
          var rs = s==="away" ? NFL_RUSHING_STATS.away : NFL_RUSHING_STATS.home;
          var ptc = NFL_TEAM_C[rs.abbr] || ACCENT;
          var isActive = side===s;
          return (
            <button key={s} onClick={function(){setSide(s);setExpand(null);}}
              style={{padding:"10px",borderRadius:12,cursor:"pointer",
                border:"2px solid "+(isActive?ptc:BORDER),
                background:isActive?ptc+"22":"transparent",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:3}}>{rs.abbr}</div>
              <div style={{fontSize:13,fontWeight:800,
                color:isActive?ptc:TEXT}}>Rush Attack</div>
            </button>
          );
        })}
      </div>

      {view==="Game Stats" && (
        <div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:10}}>
              {team.abbr} TEAM RUSHING
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
              {[
                {label:"Rush Att",  val:team.teamStats.rushAtt,  good:team.teamStats.rushAtt>=25},
                {label:"Rush Yds",  val:team.teamStats.rushYds,  good:team.teamStats.rushYds>=120},
                {label:"YPC",       val:team.teamStats.ypc,      good:team.teamStats.ypc>=4.5},
                {label:"Rush TDs",  val:team.teamStats.rushTds,  good:team.teamStats.rushTds>=1},
                {label:"Rush Rank", val:"#"+team.teamStats.rushRank,good:team.teamStats.rushRank<=10},
                {label:"Opp Rush/G",val:team.teamStats.rypgAllowed,good:team.teamStats.rypgAllowed<=100},
              ].map(function(s) {
                var c = s.good ? POS_C : TEXT2;
                return (
                  <div key={s.label} style={{background:CARD3,borderRadius:10,
                    padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:14,fontWeight:800,color:c,
                      fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{s.val}</div>
                    <div style={{fontSize:8,color:MUTED}}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>RUSHING BREAKDOWN</div>

          {team.players.map(function(p, i) {
            var isExpanded = expand===p.name;
            var posColor = p.pos==="RB1"?POS_C:p.pos==="QB Rush"?ACCENT:MUTED;
            return (
              <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,marginBottom:8,overflow:"hidden"}}>
                <div onClick={function(){setExpand(isExpanded?null:p.name);}}
                  style={{padding:"12px 14px",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {p.hot && <span style={{fontSize:10}}>🔥</span>}
                      <div>
                        <div onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                          style={{fontSize:13,fontWeight:700,color:TEXT,
                            cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                            textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                            textDecorationColor:ACCENT+"66"}}>{p.name}</div>
                        <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                          borderRadius:6,background:posColor+"22",
                          border:"1px solid "+posColor+"44",color:posColor}}>
                          {p.pos}
                        </span>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:16,fontWeight:900,color:TEXT,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{p.overview.yards}</div>
                        <div style={{fontSize:8,color:MUTED}}>Rush Yds</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:12,fontWeight:700,color:ACCENT,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{p.overview.ypc}</div>
                        <div style={{fontSize:8,color:MUTED}}>YPC</div>
                      </div>
                      <span style={{color:TEXT2,fontSize:11}}>{isExpanded?"▲":"▼"}</span>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:4}}>
                    {[
                      {l:"ATT",  v:p.overview.att},
                      {l:"TDs",  v:p.overview.tds,  hot:p.overview.tds>0},
                      {l:"Long", v:p.overview.long},
                      {l:"Tgts", v:p.overview.targets},
                      {l:"Fmb",  v:p.overview.fumbles, bad:p.overview.fumbles>0},
                    ].map(function(s) {
                      var c = s.hot?POS_C:s.bad&&s.v>0?NEG_C:TEXT2;
                      return (
                        <div key={s.l} style={{textAlign:"center",padding:"4px 2px",
                          background:CARD3,borderRadius:6}}>
                          <div style={{fontSize:11,fontWeight:700,color:c,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{s.v}</div>
                          <div style={{fontSize:7,color:MUTED}}>{s.l}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{borderTop:"1px solid "+BORDER,padding:"12px 14px"}}>
                    <div style={{fontSize:9,fontWeight:800,color:MUTED,
                      letterSpacing:".1em",marginBottom:8}}>LAST 3 GAMES</div>
                    <div style={{display:"grid",
                      gridTemplateColumns:"44px 60px 36px 44px 44px 36px",
                      padding:"6px 8px",background:CARD3,borderRadius:8,
                      marginBottom:6}}>
                      {["OPP","DATE","ATT","YDS","YPC","TD"].map(function(h){
                        return (<div key={h} style={{fontSize:8,fontWeight:700,
                          color:MUTED,textAlign:"center"}}>{h}</div>);
                      })}
                    </div>
                    {p.last3.map(function(g, j) {
                      var ypcColor = g.ypc>=5?POS_C:g.ypc<3.5?NEG_C:TEXT2;
                      return (
                        <div key={j} style={{display:"grid",
                          gridTemplateColumns:"44px 60px 36px 44px 44px 36px",
                          padding:"8px",alignItems:"center",
                          borderBottom:j<p.last3.length-1?"1px solid "+BORDER+"66":"none"}}>
                          <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:TEXT}}>{g.opp}</div>
                          <div style={{textAlign:"center",fontSize:9,color:MUTED}}>{g.date}</div>
                          <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.att}</div>
                          <div style={{textAlign:"center",fontSize:11,fontWeight:700,color:TEXT,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                          <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                            color:ypcColor,fontFamily:"'IBM Plex Mono',monospace"}}>{g.ypc}</div>
                          <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                            color:g.tds>0?POS_C:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view==="Betting Stats" && (
        <div>
          {team.players.map(function(p, i) {
            var posColor = p.pos==="RB1"?POS_C:p.pos==="QB Rush"?ACCENT:MUTED;
            return (
              <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  {p.hot && <span style={{fontSize:10}}>🔥</span>}
                  <span onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                  style={{fontSize:13,fontWeight:700,color:TEXT,
                    cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                    textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                    textDecorationColor:ACCENT+"66"}}>{p.name}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",
                    borderRadius:6,background:posColor+"22",
                    border:"1px solid "+posColor+"44",color:posColor}}>
                    {p.pos}
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[p.bet.rushYds, p.bet.tds].map(function(stat, j) {
                    if(!stat) return null;
                    var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                    var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                             stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                    var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                              stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                    return (
                      <div key={j} style={{background:bg,border:"1px solid "+bdr,
                        borderRadius:10,padding:"10px 12px"}}>
                        <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{stat.line}</div>
                        <div style={{fontSize:18,fontWeight:900,color:color,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                          {stat.rec}
                        </div>
                        <div style={{height:2,background:BORDER2,borderRadius:1,
                          overflow:"hidden",marginBottom:4}}>
                          <div style={{height:"100%",width:stat.pct+"%",
                            background:color,borderRadius:1}}/>
                        </div>
                        <div style={{fontSize:11,fontWeight:700,color:color}}>{stat.pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>BETTING KEY</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              Records show W-L on prop line this season.
              Green = 60%+ · Red = 40% or below.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function NFLPassingTab(props) {
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var sideArr = useState("away");
  var side = sideArr[0]; var setSide = sideArr[1];
  var tabArr = useState("Overview");
  var tab = tabArr[0]; var setTab = tabArr[1];

  var onSelectPlayer = props.onSelectPlayer;
  var p = side==="away" ? NFL_PASSING_STATS.away : NFL_PASSING_STATS.home;
  var opp = side==="away" ? NFL_PASSING_STATS.home : NFL_PASSING_STATS.away;
  var tc = NFL_TEAM_C[p.abbr] || ACCENT;

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,
                fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",
                color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {["away","home"].map(function(s) {
          var ps = s==="away" ? NFL_PASSING_STATS.away : NFL_PASSING_STATS.home;
          var ptc = NFL_TEAM_C[ps.abbr] || ACCENT;
          var isActive = side===s;
          return (
            <button key={s} onClick={function(){setSide(s);}}
              style={{padding:"12px",borderRadius:12,cursor:"pointer",
                border:"2px solid "+(isActive?ptc:BORDER),
                background:isActive?ptc+"22":"transparent",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{ps.abbr} QB</div>
              <div style={{display:"flex",alignItems:"center",
                justifyContent:"center",gap:4}}>
                {ps.hot && <span style={{fontSize:11}}>🔥</span>}
                <span style={{fontSize:13,fontWeight:800,
                  color:isActive?ptc:TEXT,
                  cursor:NFL_PLAYER_PAGES[ps.name]?"pointer":"default",
                  textDecoration:NFL_PLAYER_PAGES[ps.name]?"underline":"none",
                  textDecorationColor:ACCENT+"66"}}
                  onClick={function(){if(NFL_PLAYER_PAGES[ps.name]){onSelectPlayer&&onSelectPlayer(ps.name);}}}
                >{ps.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      {view==="Game Stats" && (
        <div>
          <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
            {["Overview","Advanced","Last 3 Games"].map(function(t) {
              var isActive = tab===t;
              return (
                <button key={t} onClick={function(){setTab(t);}}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                    cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                    background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":MUTED}}>
                  {t}
                </button>
              );
            })}
          </div>

          {tab==="Overview" && (
            <div>
              <div style={{background:CARD,border:"2px solid "+tc+"44",
                borderRadius:14,padding:"14px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {p.hot && <span style={{fontSize:16}}>🔥</span>}
                    <div>
                      <div style={{fontSize:9,color:MUTED}}>Starting QB</div>
                      <div onClick={function(){if(NFL_PLAYER_PAGES[p.name]){onSelectPlayer&&onSelectPlayer(p.name);}}}
                    style={{fontSize:16,fontWeight:900,color:TEXT,
                      cursor:NFL_PLAYER_PAGES[p.name]?"pointer":"default",
                      textDecoration:NFL_PLAYER_PAGES[p.name]?"underline":"none",
                      textDecorationColor:ACCENT+"66"}}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:MUTED,marginBottom:2}}>vs {opp.abbr} tonight</div>
                    <div style={{fontSize:11,color:ACCENT,fontWeight:700}}>
                      {p.overview.comp} Comp%
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
                  gap:8,marginBottom:10}}>
                  {[
                    {label:"Pass Yds",val:p.overview.yards,
                      good:p.overview.yards>=280},
                    {label:"TDs",    val:p.overview.tds,
                      good:p.overview.tds>=2},
                    {label:"INTs",   val:p.overview.ints,
                      good:p.overview.ints===0},
                  ].map(function(s) {
                    var c = s.good ? POS_C : s.label==="INTs"&&s.val>0 ? NEG_C : TEXT2;
                    return (
                      <div key={s.label} style={{background:CARD3,borderRadius:10,
                        padding:"10px 8px",textAlign:"center"}}>
                        <div style={{fontSize:18,fontWeight:900,color:c,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                          {s.val}
                        </div>
                        <div style={{fontSize:9,color:MUTED}}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  {[
                    {label:"Rating",val:p.overview.rating,
                      good:p.overview.rating>=100},
                    {label:"Comp%", val:p.overview.comp,
                      good:parseFloat(p.overview.comp)>=65},
                    {label:"Sacks", val:p.overview.sacks,
                      good:p.overview.sacks<=1},
                    {label:"Scrambles",val:p.overview.scrambles,
                      good:p.overview.scrambles>=3},
                  ].map(function(s) {
                    var c = s.good ? POS_C : TEXT2;
                    return (
                      <div key={s.label} style={{background:CARD3,borderRadius:10,
                        padding:"8px 6px",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:800,color:c,
                          fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                          {s.val}
                        </div>
                        <div style={{fontSize:8,color:MUTED}}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{padding:"10px 12px",background:AGL,
                borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
                <div style={{fontSize:9,fontWeight:800,color:ACCENT,
                  letterSpacing:".1em",marginBottom:4}}>COLOR KEY</div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                  Green = elite · Red = concerning · Season averages shown
                </div>
              </div>
            </div>
          )}

          {tab==="Advanced" && (
            <div>
              <div style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:10}}>
                  PASSING EFFICIENCY
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",
                  gap:8,marginBottom:8}}>
                  {[
                    {label:"Air Yards/Att", val:p.advanced.airYards,
                      good:p.advanced.airYards>=8.5},
                    {label:"YAC",           val:p.advanced.yac,
                      good:p.advanced.yac>=4.0},
                    {label:"aDOT",          val:p.advanced.adot,
                      good:p.advanced.adot>=9.0},
                    {label:"Under Pressure",val:p.advanced.pressure,
                      good:parseFloat(p.advanced.pressure)<=30},
                  ].map(function(s) {
                    var c = s.good ? POS_C : TEXT2;
                    return (
                      <div key={s.label} style={{background:CARD3,borderRadius:10,
                        padding:"10px 10px",display:"flex",alignItems:"center",
                        justifyContent:"space-between"}}>
                        <div style={{fontSize:10,color:MUTED}}>{s.label}</div>
                        <div style={{fontSize:14,fontWeight:800,color:c,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,padding:"14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:800,color:MUTED,
                  letterSpacing:".1em",marginBottom:10}}>
                  ACCURACY & DECISION MAKING
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[
                    {label:"CPOE",        val:p.advanced.cpoe,
                      good:parseFloat(p.advanced.cpoe)>0},
                    {label:"Bad Throw%",  val:p.advanced.badThrow,
                      good:parseFloat(p.advanced.badThrow)<10},
                    {label:"Drop Rate",   val:p.advanced.dropRate,
                      good:parseFloat(p.advanced.dropRate)<5},
                    {label:"3rd Down%",   val:p.advanced.thirdDown,
                      good:parseFloat(p.advanced.thirdDown)>=60},
                    {label:"Red Zone",    val:p.advanced.redZone,
                      good:true},
                    {label:"2-Min Drill", val:p.advanced.twoMinute,
                      good:true},
                  ].map(function(s) {
                    var c = s.good ? POS_C : TEXT2;
                    return (
                      <div key={s.label} style={{background:CARD3,borderRadius:10,
                        padding:"10px 10px",display:"flex",alignItems:"center",
                        justifyContent:"space-between"}}>
                        <div style={{fontSize:10,color:MUTED}}>{s.label}</div>
                        <div style={{fontSize:13,fontWeight:800,color:c,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{padding:"10px 12px",background:AGL,
                borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
                <div style={{fontSize:9,fontWeight:800,color:ACCENT,
                  letterSpacing:".1em",marginBottom:4}}>STAT GUIDE</div>
                <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
                  CPOE = Completion% Over Expected · aDOT = Average Depth of Target ·
                  YAC = Yards After Catch
                </div>
              </div>
            </div>
          )}

          {tab==="Last 3 Games" && (
            <div>
              <div style={{background:CARD,border:"1px solid "+BORDER,
                borderRadius:14,overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
                  fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
                  RECENT OUTINGS — {p.name.toUpperCase()}
                </div>
                <div style={{display:"grid",
                  gridTemplateColumns:"44px 60px 64px 48px 28px 28px 52px 44px",
                  padding:"7px 14px",background:CARD3,
                  borderBottom:"1px solid "+BORDER}}>
                  {["OPP","DATE","COMP","YDS","TD","INT","RATING","Result"].map(function(h){
                    return (
                      <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                        textAlign:h==="Result"?"center":"left"}}>{h}</div>
                    );
                  })}
                </div>
                {p.last3.map(function(g, i) {
                  var ratingColor = g.rating>=100?POS_C:g.rating>=85?WARN_C:NEG_C;
                  var resultColor = g.result==="W"?POS_C:NEG_C;
                  return (
                    <div key={i} style={{display:"grid",
                      gridTemplateColumns:"44px 60px 64px 48px 28px 28px 52px 44px",
                      padding:"11px 14px",alignItems:"center",
                      borderBottom:i<p.last3.length-1?"1px solid "+BORDER:"none",
                      background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                      <div style={{fontSize:12,fontWeight:800,color:TEXT}}>{g.opp}</div>
                      <div style={{fontSize:10,color:MUTED}}>{g.date}</div>
                      <div style={{fontSize:10,color:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.comp}</div>
                      <div style={{fontSize:12,fontWeight:700,color:TEXT,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                      <div style={{fontSize:12,fontWeight:700,color:g.tds>0?POS_C:TEXT2,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                      <div style={{fontSize:12,fontWeight:700,
                        color:g.ints>0?NEG_C:POS_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.ints}</div>
                      <div style={{fontSize:11,fontWeight:700,color:ratingColor,
                        fontFamily:"'IBM Plex Mono',monospace"}}>{g.rating}</div>
                      <div style={{display:"flex",justifyContent:"center"}}>
                        <div style={{width:24,height:24,borderRadius:6,
                          background:resultColor,display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>
                          {g.result}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {label:"Avg Pass Yds",
                    val:Math.round(p.last3.reduce(function(s,g){return s+g.yds;},0)/p.last3.length)},
                  {label:"Avg TDs",
                    val:Math.round((p.last3.reduce(function(s,g){return s+g.tds;},0)/p.last3.length)*10)/10},
                  {label:"Avg Rating",
                    val:Math.round((p.last3.reduce(function(s,g){return s+g.rating;},0)/p.last3.length)*10)/10},
                ].map(function(stat) {
                  return (
                    <div key={stat.label} style={{background:CARD,border:"1px solid "+BORDER,
                      borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:900,color:ACCENT,
                        fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>
                        {stat.val}
                      </div>
                      <div style={{fontSize:9,color:MUTED}}>{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {view==="Betting Stats" && (
        <div>
          <div style={{background:CARD,border:"2px solid "+tc+"44",
            borderRadius:14,overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
              display:"flex",alignItems:"center",gap:8}}>
              {p.hot && <span style={{fontSize:11}}>🔥</span>}
              <span style={{fontSize:13,fontWeight:800,color:TEXT}}>
                {p.name} — Prop Records
              </span>
            </div>
            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:9,fontWeight:800,color:MUTED,
                letterSpacing:".1em",marginBottom:8}}>PASSING PROPS</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                {[p.bet.passYds, p.bet.completions].map(function(stat, i) {
                  if(!stat) return null;
                  var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                  var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                           stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                  var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                            stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                  return (
                    <div key={i} style={{background:bg,border:"1px solid "+bdr,
                      borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{stat.line}</div>
                      <div style={{fontSize:18,fontWeight:900,color:color,
                        fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                        {stat.rec}
                      </div>
                      <div style={{height:2,background:BORDER2,borderRadius:1,
                        overflow:"hidden",marginBottom:4}}>
                        <div style={{height:"100%",width:stat.pct+"%",
                          background:color,borderRadius:1}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:color}}>{stat.pct}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:9,fontWeight:800,color:MUTED,
                letterSpacing:".1em",marginBottom:8}}>TD & TURNOVER PROPS</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[p.bet.tds, p.bet.ints].map(function(stat, i) {
                  if(!stat) return null;
                  var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
                  var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                           stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
                  var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                            stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
                  return (
                    <div key={i} style={{background:bg,border:"1px solid "+bdr,
                      borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{stat.line}</div>
                      <div style={{fontSize:18,fontWeight:900,color:color,
                        fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                        {stat.rec}
                      </div>
                      <div style={{height:2,background:BORDER2,borderRadius:1,
                        overflow:"hidden",marginBottom:4}}>
                        <div style={{height:"100%",width:stat.pct+"%",
                          background:color,borderRadius:1}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:color}}>{stat.pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{padding:"10px 12px",background:AGL,
            borderRadius:10,border:"1px solid rgba(77,159,255,.2)"}}>
            <div style={{fontSize:9,fontWeight:800,color:ACCENT,
              letterSpacing:".1em",marginBottom:4}}>BETTING KEY</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              Records show W-L on each prop line this season.
              Green = 60%+ hit rate · Red = 40% or below.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function NFLSummaryTab() {
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var expandArr = useState(null);
  var expand = expandArr[0]; var setExpand = expandArr[1];
  var sd = NFL_SUMMARY_DATA;

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14,
        background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
        {["Game Stats","Betting Stats"].map(function(v) {
          var isActive = view===v;
          return (
            <button key={v} onClick={function(){setView(v);}}
              style={{padding:"8px",borderRadius:9,fontSize:12,
                fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",
                color:isActive?"#fff":MUTED}}>
              {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
            </button>
          );
        })}
      </div>

      {view==="Betting Stats" && (
        <div>
          {[sd.away, sd.home].map(function(team) {
            var tc = NFL_TEAM_C[team.abbr] || ACCENT;
            var b = team.bet || {};
            return (
              <div key={team.abbr} style={{background:CARD,borderRadius:14,
                border:"2px solid "+(tc+"44"),marginBottom:14,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:26,height:26,borderRadius:8,background:tc+"22",
                      border:"1px solid "+tc+"44",display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:10,fontWeight:800,color:tc}}>
                      {team.abbr}
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:TEXT}}>
                      {team.abbr} Betting Record
                    </span>
                  </div>
                  <div style={{display:"flex",gap:3}}>
                    {team.form.map(function(r,i){
                      return (<div key={i} style={{width:7,height:7,borderRadius:"50%",
                        background:r==="W"?POS_C:r==="L"?NEG_C:WARN_C}}/>);
                    })}
                  </div>
                </div>
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>MONEY LINE / SPREAD</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
                    <BetTile rec={b.ml.rec}     pct={b.ml.pct}     label={b.ml.label}/>
                    <BetTile rec={b.spread.rec}  pct={b.spread.pct}  label={b.spread.label}/>
                  </div>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>TOTALS</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
                    <BetTile rec={b.over.rec}   pct={b.over.pct}   label={b.over.label}/>
                    <BetTile rec={b.under.rec}  pct={b.under.pct}  label={b.under.label}/>
                  </div>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>FIRST HALF</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                    <BetTile rec={b.f1h_ml.rec}    pct={b.f1h_ml.pct}    label={b.f1h_ml.label}/>
                    <BetTile rec={b.f1h_over.rec}  pct={b.f1h_over.pct}  label={b.f1h_over.label}/>
                    <BetTile rec={b.f1h_under.rec} pct={b.f1h_under.pct} label={b.f1h_under.label}/>
                  </div>
                  <div style={{fontSize:9,fontWeight:800,color:MUTED,
                    letterSpacing:".1em",marginBottom:8}}>TEAM SCORING</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    <BetTile rec={b.td_over.rec} pct={b.td_over.pct} label={b.td_over.label}/>
                    <BetTile rec={b.spread.rec}  pct={b.spread.pct}  label="Home ATS"/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view==="Game Stats" && (
        <div>
          {[sd.away, sd.home].map(function(team) {
            var tc = NFL_TEAM_C[team.abbr] || ACCENT;
            var isExpanded = expand===team.abbr;
            return (
              <div key={team.abbr} style={{background:CARD,borderRadius:14,
                border:"2px solid "+(tc+"44"),marginBottom:12,overflow:"hidden"}}>
                <div style={{padding:"12px 14px",borderBottom:"1px solid "+BORDER}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:32,height:32,borderRadius:10,background:tc+"22",
                        border:"1px solid "+tc+"44",display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:11,fontWeight:800,color:tc}}>
                        {team.abbr}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:TEXT}}>
                          {team.abbr}
                        </div>
                        <div style={{fontSize:10,color:MUTED}}>{team.record} · {team.winPct}% win</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      {team.form.map(function(r,i){
                        return (<div key={i} style={{width:8,height:8,borderRadius:"50%",
                          background:r==="W"?POS_C:NEG_C}}/>);
                      })}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
                      <div style={{fontSize:9,color:MUTED,marginBottom:3}}>OFFENSE</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                        {[
                          {l:"PPG",   v:team.ppg},
                          {l:"Pass",  v:team.passYpg},
                          {l:"Rush",  v:team.rushYpg},
                          {l:"3rd%",  v:team.thirdDown},
                        ].map(function(s){
                          return (
                            <div key={s.l} style={{textAlign:"center",padding:"4px 2px"}}>
                              <div style={{fontSize:12,fontWeight:700,color:POS_C,
                                fontFamily:"'IBM Plex Mono',monospace"}}>{s.v}</div>
                              <div style={{fontSize:8,color:MUTED}}>{s.l}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
                      <div style={{fontSize:9,color:MUTED,marginBottom:3}}>DEFENSE</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                        {[
                          {l:"PPG",   v:team.papg},
                          {l:"Pass",  v:team.passYpaAllowed},
                          {l:"Rush",  v:team.rushYpaAllowed},
                          {l:"RZ%",   v:team.redZone},
                        ].map(function(s){
                          return (
                            <div key={s.l} style={{textAlign:"center",padding:"4px 2px"}}>
                              <div style={{fontSize:12,fontWeight:700,color:NEG_C,
                                fontFamily:"'IBM Plex Mono',monospace"}}>{s.v}</div>
                              <div style={{fontSize:8,color:MUTED}}>{s.l}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button onClick={function(){setExpand(isExpanded?null:team.abbr);}}
                    style={{width:"100%",padding:"6px",borderRadius:8,fontSize:10,
                      fontWeight:600,cursor:"pointer",background:CARD3,
                      border:"1px solid "+BORDER,color:TEXT2}}>
                    {isExpanded?"Hide":"Show"} Last 5 Games
                  </button>
                </div>
                {isExpanded && (
                  <div style={{overflowX:"auto"}}>
                    <div style={{display:"grid",
                      gridTemplateColumns:"60px 44px 30px 44px 44px 60px 36px 36px",
                      padding:"7px 12px",background:CARD3,
                      borderBottom:"1px solid "+BORDER,minWidth:380}}>
                      {["DATE","OPP","W/L","PTS","OPP","PASS","ATS","O/U"].map(function(h){
                        return (<div key={h} style={{fontSize:8,fontWeight:700,
                          color:MUTED,textAlign:"center"}}>{h}</div>);
                      })}
                    </div>
                    {team.log.map(function(g,i){
                      var wlColor = g.wl==="W"?POS_C:NEG_C;
                      var atsColor = g.ats==="W"?POS_C:NEG_C;
                      var ouColor = g.ou==="O"?NEG_C:POS_C;
                      return (
                        <div key={i} style={{display:"grid",
                          gridTemplateColumns:"60px 44px 30px 44px 44px 60px 36px 36px",
                          padding:"9px 12px",minWidth:380,alignItems:"center",
                          borderBottom:i<team.log.length-1?"1px solid "+BORDER:"none",
                          background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                          <div style={{textAlign:"center",fontSize:9,color:MUTED}}>{g.date}</div>
                          <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:TEXT}}>{g.opp}</div>
                          <div style={{textAlign:"center",fontSize:10,fontWeight:800,color:wlColor}}>{g.wl}</div>
                          <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                            color:wlColor,fontFamily:"'IBM Plex Mono',monospace"}}>{g.pts}</div>
                          <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.opp_pts}</div>
                          <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{g.pass}</div>
                          <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:atsColor}}>{g.ats}</div>
                          <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:ouColor}}>{g.ou}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function NFLTrendsTab() {
  var tagArr = useState("All");
  var activeTag = tagArr[0]; var setActiveTag = tagArr[1];
  var tags = ["All","Form","H2H","Offense","Defense","Betting","Situational","Injuries"];
  var filtered = activeTag==="All" ? NFL_TRENDS_DATA :
    NFL_TRENDS_DATA.filter(function(t){return t.cat===activeTag;});
  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
        {tags.map(function(tag) {
          var isActive = activeTag===tag;
          return (
            <button key={tag} onClick={function(){setActiveTag(tag);}}
              style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {tag}
            </button>
          );
        })}
      </div>
      {filtered.map(function(t, i) {
        var tagColor = t.hot ? HOT_C : COLD_C;
        var tagBg    = t.hot ? "rgba(255,107,43,.08)" : "rgba(125,212,252,.08)";
        var tagBdr   = t.hot ? "rgba(255,107,43,.2)"  : "rgba(125,212,252,.2)";
        return (
          <div key={i} style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:16}}>{t.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:TEXT,lineHeight:1.3,
                  marginBottom:4}}>{t.title}</div>
                <span style={{fontSize:9,fontWeight:700,padding:"1px 7px",
                  borderRadius:10,background:tagBg,border:"1px solid "+tagBdr,
                  color:tagColor}}>
                  {t.cat}
                </span>
              </div>
            </div>
            <div style={{fontSize:11,color:TEXT2,lineHeight:1.7}}>{t.body}</div>
          </div>
        );
      })}
    </div>
  );
}


function NFLAnalysisTab(props) {
  var game = props.game;
  var filterArr = useState("All");
  var filter = filterArr[0]; var setFilter = filterArr[1];
  var showSummaryArr = useState(false);
  var showSummary = showSummaryArr[0]; var setShowSummary = showSummaryArr[1];
  var signalFactorArr = useState(null);
  var signalFactor = signalFactorArr[0]; var setSignalFactor = signalFactorArr[1];

  var spreadEdges = NFL_FULL_EDGES.filter(function(e){return e.type==="spread"||e.type==="ml";});
  var totalEdges  = NFL_FULL_EDGES.filter(function(e){return e.type==="total";});
  var propEdges   = NFL_FULL_EDGES.filter(function(e){return e.type==="prop";});

  var filteredEdges = filter==="All"        ? NFL_FULL_EDGES.slice(1) :
                      filter==="Spread/ML"  ? spreadEdges.slice(1) :
                      filter==="Totals"     ? totalEdges :
                      filter==="Props"      ? propEdges : [];

  var isParlays = filter==="Parlays";
  var topEdge   = NFL_FULL_EDGES[0];

  return (
    <div style={{padding:"14px",animation:"fadeUp .2s ease"}}>
      {signalFactor && (
        <NFLSignalInfoModal f={signalFactor}
          onClose={function(){setSignalFactor(null);}}/>
      )}

      <NFLMatchupOverview onOpenSummary={function(){setShowSummary(true);}}/>

      <div style={{background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.25)",
        borderRadius:14,padding:"14px",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
          <span style={{fontSize:9,fontWeight:800,color:WARN_C,letterSpacing:".1em"}}>
            🏆 TOP EDGE THIS GAME
          </span>
          <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,
            background:POS_C+"22",border:"1px solid "+POS_C+"44",color:POS_C}}>
            📈 {topEdge.grade}
          </span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{topEdge.icon}</span>
          <span style={{fontSize:15,fontWeight:900,color:TEXT}}>{topEdge.bet}</span>
        </div>
        <div style={{fontSize:11,color:TEXT2,lineHeight:1.6,marginBottom:10}}>
          {topEdge.analysis}
        </div>
        <ConfBar pct={topEdge.conf}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Sample Line</div>
            <div style={{fontSize:11,fontWeight:800,color:ACCENT,
              fontFamily:"'IBM Plex Mono',monospace"}}>{topEdge.line}</div>
          </div>
          <div style={{background:CARD3,borderRadius:10,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:MUTED,marginBottom:3}}>Alt Play</div>
            <div style={{fontSize:10,fontWeight:600,color:TEXT2,lineHeight:1.3}}>
              {topEdge.altPlay}
            </div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[
          {label:"Spread/ML",n:spreadEdges.length,pct:88},
          {label:"Totals",   n:totalEdges.length, pct:81},
          {label:"Props",    n:propEdges.length,  pct:76},
        ].map(function(box) {
          return (
            <div key={box.label} style={{background:CARD3,borderRadius:12,
              padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:TEXT}}>{box.n}</div>
              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>{box.label}</div>
              <ConfBar pct={box.pct}/>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:8,paddingBottom:4}}>
        {["All","Spread/ML","Totals","Props","Parlays"].map(function(f) {
          var isActive=filter===f;
          return (
            <button key={f} onClick={function(){setFilter(f);}}
              style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                background:isActive?ACCENT:"transparent",
                border:"1px solid "+(isActive?ACCENT:BORDER),
                color:isActive?"#fff":MUTED}}>
              {f==="Parlays"?"🏦 Parlays":f}
            </button>
          );
        })}
      </div>

      {isParlays ? (
        <NFLParlayBuilder/>
      ) : (
        <div>
          {filteredEdges.map(function(edge) {
            return (
              <NFLEdgeCard key={edge.id} edge={edge}
                onInfo={function(f){setSignalFactor(f);}}/>
            );
          })}
          <div style={{padding:"12px 14px",background:"rgba(251,191,36,.06)",
            border:"1px solid rgba(251,191,36,.15)",borderRadius:10,marginTop:8}}>
            <div style={{fontSize:9,fontWeight:800,color:WARN_C,
              letterSpacing:".1em",marginBottom:4}}>DISCLAIMER</div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              EdgeView's engine uses statistical rules and historical patterns.
              NOT financial advice. Always verify odds and gamble responsibly.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function BreakdownPage(props) {
  var game = props.game;
  var onBack = props.onBack;
  var sport = props.sport || "mlb";
  var onSelectPlayer = props.onSelectPlayer;
  var tabArr = useState("Analysis");
  var tab = tabArr[0]; var setTab = tabArr[1];
  var gd = GAME_DATA;

  var mlbTabs = [
    {id:"Analysis",icon:"🤖"},
    {id:"Trends",icon:"📊"},
    {id:"Summary",icon:"📋"},
    {id:"Batting",icon:"🔥"},
    {id:"Pitching",icon:"⚾"},
    {id:"Game Log",icon:"📓"},
    {id:"Ballpark",icon:"🏟"},
  ];
  var nflTabs = [
    {id:"Analysis",icon:"🤖"},
    {id:"Trends",icon:"📊"},
    {id:"Summary",icon:"📋"},
    {id:"Passing",icon:"🏈"},
    {id:"Rushing",icon:"🏃"},
    {id:"Receiving",icon:"🎯"},
    {id:"Defense",icon:"🛡"},
    {id:"Stadium",icon:"🏟"},
  ];
  var tabs = sport==="nfl" ? nflTabs : mlbTabs;
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",
      background:BG,overflowY:"hidden"}}>
      <style>{APP_CSS}</style>
      <div style={{background:CARD,borderBottom:"1px solid "+BORDER,
        padding:"12px 14px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <button onClick={onBack}
            style={{width:32,height:32,borderRadius:10,background:CARD3,
              border:"1px solid "+BORDER,color:TEXT2,cursor:"pointer",
              fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ←
          </button>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {sport==="nfl" ? (
                <span style={{fontSize:15,fontWeight:900,
                  color:NFL_TEAM_C[NFL_GAME.away.abbr]||ACCENT}}>
                  {NFL_GAME.away.abbr}
                </span>
              ) : (
                <span style={{fontSize:15,fontWeight:900,color:gd.away.c}}>
                  {gd.away.abbr}
                </span>
              )}
              <span style={{fontSize:11,color:MUTED}}>@</span>
              {sport==="nfl" ? (
                <span style={{fontSize:15,fontWeight:900,
                  color:NFL_TEAM_C[NFL_GAME.home.abbr]||ACCENT}}>
                  {NFL_GAME.home.abbr}
                </span>
              ) : (
                <span style={{fontSize:15,fontWeight:900,color:gd.home.c}}>
                  {gd.home.abbr}
                </span>
              )}
              <span style={{fontSize:10,color:MUTED,marginLeft:4}}>
                {sport==="nfl"
                  ? NFL_GAME.venue+" · "+NFL_GAME.status
                  : gd.venue+" · "+gd.status}
              </span>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            {sport==="nfl" ? (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:800,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {NFL_GAME.spread}
                  </span>
                  <span style={{fontSize:10,color:MUTED}}>·</span>
                  <span style={{fontSize:14,fontWeight:800,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    O/U {NFL_GAME.total}
                  </span>
                </div>
                <div style={{fontSize:9,color:MUTED}}>
                  Win Prob: {NFL_GAME.home.abbr} {NFL_GAME.winProb}%
                </div>
              </div>
            ) : (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:20,fontWeight:900,color:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{gd.score.away}</span>
                  <div>
                    <div style={{fontSize:8,color:MUTED}}>▲{gd.inning}</div>
                  </div>
                  <span style={{fontSize:20,fontWeight:900,color:POS_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{gd.score.home}</span>
                </div>
                <div style={{fontSize:9,color:MUTED}}>Win Prob: NYY {gd.winProb.home}%</div>
              </div>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:0,overflowX:"auto",borderTop:"1px solid "+BORDER,
          paddingTop:8,marginTop:4}}>
          {tabs.map(function(t) {
            var isActive = tab===t.id;
            return (
              <button key={t.id} onClick={function(){setTab(t.id);}}
                style={{display:"flex",alignItems:"center",gap:4,
                  padding:"4px 10px",borderRadius:0,fontSize:11,
                  fontWeight:isActive?700:500,cursor:"pointer",
                  background:"transparent",border:"none",
                  color:isActive?TEXT:MUTED,whiteSpace:"nowrap",
                  borderBottom:isActive?"2px solid "+ACCENT:"2px solid transparent",
                  transition:"all .15s"}}>
                <span style={{fontSize:12}}>{t.icon}</span>
                <span>{t.id}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {sport==="mlb" && tab==="Analysis"  && <AnalysisTab/>}
        {sport==="mlb" && tab==="Trends"    && <TrendsTab/>}
        {sport==="mlb" && tab==="Summary"   && <SummaryTab/>}
        {sport==="mlb" && tab==="Batting"   && <BattingTab/>}
        {sport==="mlb" && tab==="Pitching"  && <PitchingTab/>}
        {sport==="mlb" && tab==="Game Log"  && <GameLogTab/>}
        {sport==="mlb" && tab==="Ballpark"  && <BallparkTab/>}
        {sport==="nfl" && tab==="Analysis"  && <NFLAnalysisTab game={game}/>}
        {sport==="nfl" && tab==="Trends"    && <NFLTrendsTab/>}
        {sport==="nfl" && tab==="Summary"   && <NFLSummaryTab/>}
        {sport==="nfl" && tab==="Passing"   && <NFLPassingTab onSelectPlayer={onSelectPlayer}/>}
        {sport==="nfl" && tab==="Rushing"   && <NFLRushingTab onSelectPlayer={onSelectPlayer}/>}
        {sport==="nfl" && tab==="Receiving" && <NFLReceivingTab onSelectPlayer={onSelectPlayer}/>}
        {sport==="nfl" && tab==="Defense"   && <NFLDefenseTab/>}
        {sport==="nfl" && tab==="Stadium"   && <NFLStadiumTab/>}
      </div>
    </div>
  );
}

// ── PLACEHOLDER TABS ──────────────────────────────────────────────────────────
// ── NFL LEADERS DATA ──────────────────────────────────────────────────────────
var NFL_LEADERS_QB_CATS   = ["Pass Yds","TDs","Comp%","Rating","Rush Yds","Sacks Taken"];
var NFL_LEADERS_RB_CATS   = ["Rush Yds","Rush TDs","Yards/Carry","Receptions","Rec Yds","Fumbles"];
var NFL_LEADERS_TE_CATS     = ["Rec Yds","Receptions","Targets","TDs","Yards/Rec","Target%"];
var NFL_LEADERS_BET_TE_CATS = ["Rec Yds Props","Reception Props","Target Props","TD Props"];


var NFL_LEADERS_NFL_TEAM_CATS     = ["Points/G","Pass Yds/G","Rush Yds/G","Points Allowed/G","Sacks","Turnovers"];
var NFL_LEADERS_BET_NFL_TEAM_CATS = ["ATS","Over","Under","Away ATS","Home ATS"];


var NFL_LEADERS_WR_CATS   = ["Rec Yds","Receptions","Targets","TDs","Yards/Rec","Target%"];
var NFL_LEADERS_DEF_CATS  = ["Sacks","INT","Tackles","PD","FF","TFL"];

var NFL_LEADERS_BET_QB_CATS  = ["Pass Yds Props","TD Props","Rush Yds Props","INT Props"];
var NFL_LEADERS_BET_RB_CATS  = ["Rush Yds Props","Rec Props","TD Props","Carries Props"];
var NFL_LEADERS_BET_WR_CATS  = ["Rec Yds Props","Reception Props","Target Props","TD Props"];
var NFL_LEADERS_BET_DEF_CATS = ["Sack Props","Tackle Props","INT Props"];

var NFL_LEADERS = {
  QB:{
    "Pass Yds":[
      {rank:1,name:"P. Mahomes",  team:"KC", val:"4,112",hot:true,  note:"312 avg/G"},
      {rank:2,name:"J. Burrow",   team:"CIN",val:"3,984",hot:true,  note:"296 avg/G"},
      {rank:3,name:"J. Hurts",    team:"PHI",val:"3,741",hot:false, note:"278 avg/G"},
      {rank:4,name:"L. Jackson",  team:"BAL",val:"3,628",hot:true,  note:"268 avg/G"},
      {rank:5,name:"J. Allen",    team:"BUF",val:"3,584",hot:false, note:"264 avg/G"},
      {rank:6,name:"T. Lawrence", team:"JAX",val:"3,412",hot:false, note:"252 avg/G"},
      {rank:7,name:"D. Prescott", team:"DAL",val:"3,288",hot:false, note:"241 avg/G"},
      {rank:8,name:"J. Goff",     team:"DET",val:"3,241",hot:false, note:"238 avg/G"},
      {rank:9,name:"B. Purdy",    team:"SF", val:"3,184",hot:false, note:"234 avg/G"},
      {rank:10,name:"K. Murray",  team:"ARI",val:"3,021",hot:false, note:"221 avg/G"},
    ],
    "TDs":[
      {rank:1,name:"P. Mahomes",  team:"KC", val:"32",hot:true,  note:"2.4 TD/G"},
      {rank:2,name:"J. Burrow",   team:"CIN",val:"29",hot:true,  note:"2.1 TD/G"},
      {rank:3,name:"L. Jackson",  team:"BAL",val:"28",hot:true,  note:"2.1 TD/G"},
      {rank:4,name:"J. Hurts",    team:"PHI",val:"26",hot:false, note:"1.9 TD/G"},
      {rank:5,name:"J. Allen",    team:"BUF",val:"25",hot:false, note:"1.9 TD/G"},
      {rank:6,name:"T. Lawrence", team:"JAX",val:"22",hot:false, note:"1.6 TD/G"},
      {rank:7,name:"J. Goff",     team:"DET",val:"21",hot:false, note:"1.5 TD/G"},
      {rank:8,name:"B. Purdy",    team:"SF", val:"20",hot:false, note:"1.5 TD/G"},
      {rank:9,name:"D. Prescott", team:"DAL",val:"18",hot:false, note:"1.3 TD/G"},
      {rank:10,name:"K. Murray",  team:"ARI",val:"16",hot:false, note:"1.2 TD/G"},
    ],
    "Comp%":[
      {rank:1,name:"B. Purdy",    team:"SF", val:"71.4%",hot:false,note:"Elite accuracy"},
      {rank:2,name:"J. Goff",     team:"DET",val:"70.8%",hot:false,note:"High floor"},
      {rank:3,name:"P. Mahomes",  team:"KC", val:"68.2%",hot:true, note:"Efficiency king"},
      {rank:4,name:"J. Burrow",   team:"CIN",val:"67.9%",hot:true, note:"Elite touch"},
      {rank:5,name:"L. Jackson",  team:"BAL",val:"66.4%",hot:false,note:"Improved accuracy"},
      {rank:6,name:"J. Hurts",    team:"PHI",val:"64.8%",hot:false,note:"Steady"},
      {rank:7,name:"J. Allen",    team:"BUF",val:"63.2%",hot:false,note:"High volume"},
      {rank:8,name:"T. Lawrence", team:"JAX",val:"62.8%",hot:false,note:"Inconsistent"},
      {rank:9,name:"D. Prescott", team:"DAL",val:"61.4%",hot:false,note:"Struggling"},
      {rank:10,name:"K. Murray",  team:"ARI",val:"60.1%",hot:false,note:"Erratic"},
    ],
    "Rating":[
      {rank:1,name:"P. Mahomes",  team:"KC", val:"108.4",hot:true, note:"MVP pace"},
      {rank:2,name:"J. Burrow",   team:"CIN",val:"104.2",hot:true, note:"Elite"},
      {rank:3,name:"B. Purdy",    team:"SF", val:"102.8",hot:false,note:"System boost"},
      {rank:4,name:"L. Jackson",  team:"BAL",val:"101.4",hot:true, note:"Historic"},
      {rank:5,name:"J. Goff",     team:"DET",val:"98.6", hot:false,note:"Career best"},
      {rank:6,name:"J. Hurts",    team:"PHI",val:"96.4", hot:false,note:"Steady"},
      {rank:7,name:"J. Allen",    team:"BUF",val:"94.8", hot:false,note:"Volume driven"},
      {rank:8,name:"T. Lawrence", team:"JAX",val:"88.4", hot:false,note:"Below potential"},
      {rank:9,name:"D. Prescott", team:"DAL",val:"84.2", hot:false,note:"Declining"},
      {rank:10,name:"K. Murray",  team:"ARI",val:"81.6", hot:false,note:"Struggling"},
    ],
    "Rush Yds":[
      {rank:1,name:"L. Jackson",  team:"BAL",val:"824",hot:true, note:"68 avg/G"},
      {rank:2,name:"J. Hurts",    team:"PHI",val:"612",hot:false,note:"51 avg/G"},
      {rank:3,name:"J. Allen",    team:"BUF",val:"488",hot:false,note:"40 avg/G"},
      {rank:4,name:"P. Mahomes",  team:"KC", val:"314",hot:false,note:"26 avg/G"},
      {rank:5,name:"T. Lawrence", team:"JAX",val:"284",hot:false,note:"24 avg/G"},
      {rank:6,name:"K. Murray",   team:"ARI",val:"271",hot:false,note:"22 avg/G"},
      {rank:7,name:"J. Burrow",   team:"CIN",val:"198",hot:false,note:"16 avg/G"},
      {rank:8,name:"J. Goff",     team:"DET",val:"124",hot:false,note:"10 avg/G"},
      {rank:9,name:"B. Purdy",    team:"SF", val:"108",hot:false,note:"9 avg/G"},
      {rank:10,name:"D. Prescott",team:"DAL",val:"94", hot:false,note:"8 avg/G"},
    ],
    "Sacks Taken":[
      {rank:1,name:"D. Prescott", team:"DAL",val:"42",hot:false,note:"High pressure rate"},
      {rank:2,name:"T. Lawrence", team:"JAX",val:"38",hot:false,note:"OL struggles"},
      {rank:3,name:"K. Murray",   team:"ARI",val:"34",hot:false,note:"Holds too long"},
      {rank:4,name:"J. Allen",    team:"BUF",val:"28",hot:false,note:"Improvises late"},
      {rank:5,name:"J. Burrow",   team:"CIN",val:"24",hot:false,note:"Improved pocket"},
      {rank:6,name:"L. Jackson",  team:"BAL",val:"18",hot:false,note:"Avoids pressure"},
      {rank:7,name:"J. Hurts",    team:"PHI",val:"16",hot:false,note:"Mobile escape"},
      {rank:8,name:"P. Mahomes",  team:"KC", val:"14",hot:false,note:"Elite release"},
      {rank:9,name:"J. Goff",     team:"DET",val:"12",hot:false,note:"Quick reads"},
      {rank:10,name:"B. Purdy",   team:"SF", val:"11",hot:false,note:"Protected well"},
    ],
  },
  RB:{
    "Rush Yds":[
      {rank:1,name:"D. Henry",    team:"TEN",val:"1,284",hot:true, note:"88 avg/G"},
      {rank:2,name:"C. McCaffrey",team:"SF", val:"1,214",hot:true, note:"84 avg/G"},
      {rank:3,name:"J. Gibbs",    team:"DET",val:"1,048",hot:true, note:"72 avg/G"},
      {rank:4,name:"B. Robinson",team:"ATL", val:"984",hot:false,note:"68 avg/G"},
      {rank:5,name:"T. Pollard",  team:"TEN",val:"894",hot:false,note:"62 avg/G"},
      {rank:6,name:"R. Stevenson",team:"NE", val:"812",hot:false,note:"56 avg/G"},
      {rank:7,name:"A. Jones",    team:"MIN",val:"784",hot:false,note:"54 avg/G"},
      {rank:8,name:"K. Williams", team:"LAC",val:"748",hot:false,note:"52 avg/G"},
      {rank:9,name:"J. Jacobs",   team:"LV", val:"712",hot:false,note:"49 avg/G"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"684",hot:false,note:"47 avg/G"},
    ],
    "Rush TDs":[
      {rank:1,name:"D. Henry",    team:"TEN",val:"14",hot:true, note:"Red zone force"},
      {rank:2,name:"C. McCaffrey",team:"SF", val:"12",hot:true, note:"Versatile TD threat"},
      {rank:3,name:"J. Gibbs",    team:"DET",val:"10",hot:true, note:"Goal line role"},
      {rank:4,name:"B. Robinson",team:"ATL", val:"9", hot:false,note:"Workhorse"},
      {rank:5,name:"T. Pollard",  team:"TEN",val:"8", hot:false,note:"Speed back"},
      {rank:6,name:"A. Jones",    team:"MIN",val:"7", hot:false,note:"Veteran"},
      {rank:7,name:"R. Stevenson",team:"NE", val:"6", hot:false,note:"Short yardage"},
      {rank:8,name:"K. Williams", team:"LAC",val:"6", hot:false,note:"Explosive"},
      {rank:9,name:"J. Jacobs",   team:"LV", val:"5", hot:false,note:"Steady"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"5", hot:false,note:"Consistent"},
    ],
    "Yards/Carry":[
      {rank:1,name:"J. Gibbs",    team:"DET",val:"5.8",hot:true, note:"Explosive cuts"},
      {rank:2,name:"C. McCaffrey",team:"SF", val:"5.4",hot:true, note:"Elite vision"},
      {rank:3,name:"T. Pollard",  team:"TEN",val:"5.1",hot:false,note:"Speed back"},
      {rank:4,name:"K. Williams", team:"LAC",val:"4.9",hot:false,note:"Big play ability"},
      {rank:5,name:"D. Henry",    team:"TEN",val:"4.8",hot:false,note:"Power"},
      {rank:6,name:"B. Robinson",team:"ATL", val:"4.6",hot:false,note:"Solid"},
      {rank:7,name:"A. Jones",    team:"MIN",val:"4.4",hot:false,note:"Veteran"},
      {rank:8,name:"J. Jacobs",   team:"LV", val:"4.2",hot:false,note:"Consistent"},
      {rank:9,name:"R. Stevenson",team:"NE", val:"4.1",hot:false,note:"Steady"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"3.9",hot:false,note:"Limited upside"},
    ],
    "Receptions":[
      {rank:1,name:"C. McCaffrey",team:"SF", val:"68",hot:true, note:"5.0 rec/G"},
      {rank:2,name:"J. Gibbs",    team:"DET",val:"54",hot:true, note:"3.9 rec/G"},
      {rank:3,name:"T. Pollard",  team:"TEN",val:"48",hot:false,note:"3.5 rec/G"},
      {rank:4,name:"A. Jones",    team:"MIN",val:"42",hot:false,note:"3.1 rec/G"},
      {rank:5,name:"K. Williams", team:"LAC",val:"38",hot:false,note:"2.8 rec/G"},
      {rank:6,name:"B. Robinson",team:"ATL", val:"34",hot:false,note:"2.5 rec/G"},
      {rank:7,name:"J. Jacobs",   team:"LV", val:"31",hot:false,note:"2.3 rec/G"},
      {rank:8,name:"R. Stevenson",team:"NE", val:"28",hot:false,note:"2.1 rec/G"},
      {rank:9,name:"D. Henry",    team:"TEN",val:"24",hot:false,note:"1.8 rec/G"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"21",hot:false,note:"1.5 rec/G"},
    ],
    "Rec Yds":[
      {rank:1,name:"C. McCaffrey",team:"SF", val:"584",hot:true, note:"42 avg/G"},
      {rank:2,name:"J. Gibbs",    team:"DET",val:"448",hot:true, note:"32 avg/G"},
      {rank:3,name:"T. Pollard",  team:"TEN",val:"384",hot:false,note:"28 avg/G"},
      {rank:4,name:"A. Jones",    team:"MIN",val:"314",hot:false,note:"23 avg/G"},
      {rank:5,name:"K. Williams", team:"LAC",val:"288",hot:false,note:"21 avg/G"},
      {rank:6,name:"J. Jacobs",   team:"LV", val:"241",hot:false,note:"18 avg/G"},
      {rank:7,name:"B. Robinson",team:"ATL", val:"224",hot:false,note:"16 avg/G"},
      {rank:8,name:"R. Stevenson",team:"NE", val:"198",hot:false,note:"14 avg/G"},
      {rank:9,name:"D. Henry",    team:"TEN",val:"168",hot:false,note:"12 avg/G"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"148",hot:false,note:"11 avg/G"},
    ],
    "Fumbles":[
      {rank:1,name:"J. Jacobs",   team:"LV", val:"4",hot:false,note:"Ball security issue"},
      {rank:2,name:"D. Henry",    team:"TEN",val:"3",hot:false,note:"Contact fumbler"},
      {rank:3,name:"T. Pollard",  team:"TEN",val:"3",hot:false,note:"Open field risk"},
      {rank:4,name:"B. Robinson",team:"ATL", val:"2",hot:false,note:"Improving"},
      {rank:5,name:"R. Stevenson",team:"NE", val:"2",hot:false,note:"Minor concern"},
      {rank:6,name:"A. Jones",    team:"MIN",val:"1",hot:false,note:"Veteran care"},
      {rank:7,name:"K. Williams", team:"LAC",val:"1",hot:false,note:"Solid security"},
      {rank:8,name:"C. McCaffrey",team:"SF", val:"1",hot:false,note:"Rare issue"},
      {rank:9,name:"J. Gibbs",    team:"DET",val:"1",hot:false,note:"Learning"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"0",hot:false,note:"Clean hands"},
    ],
  },
  WR:{
    "Rec Yds":[
      {rank:1,name:"T. Hill",     team:"MIA",val:"1,412",hot:true, note:"101 avg/G"},
      {rank:2,name:"J. Chase",    team:"CIN",val:"1,284",hot:true, note:"92 avg/G"},
      {rank:3,name:"S. Diggs",    team:"BUF",val:"1,148",hot:true, note:"82 avg/G"},
      {rank:4,name:"C. Lamb",     team:"DAL",val:"1,084",hot:false,note:"77 avg/G"},
      {rank:5,name:"D. Adams",    team:"LV", val:"984", hot:false,note:"70 avg/G"},
      {rank:6,name:"A. Cooper",   team:"CLE",val:"912", hot:false,note:"65 avg/G"},
      {rank:7,name:"D. Samuel",   team:"SF", val:"884", hot:false,note:"63 avg/G"},
      {rank:8,name:"D. Metcalf",  team:"SEA",val:"848", hot:false,note:"61 avg/G"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"812", hot:false,note:"58 avg/G"},
      {rank:10,name:"A. St. Brown",team:"DET",val:"784",hot:false,note:"56 avg/G"},
    ],
    "Receptions":[
      {rank:1,name:"S. Diggs",    team:"BUF",val:"84",hot:true, note:"6.0 rec/G"},
      {rank:2,name:"C. Lamb",     team:"DAL",val:"81",hot:false,note:"5.8 rec/G"},
      {rank:3,name:"T. Hill",     team:"MIA",val:"78",hot:true, note:"5.6 rec/G"},
      {rank:4,name:"A. St. Brown",team:"DET",val:"74",hot:false,note:"5.3 rec/G"},
      {rank:5,name:"J. Chase",    team:"CIN",val:"68",hot:true, note:"4.9 rec/G"},
      {rank:6,name:"D. Adams",    team:"LV", val:"64",hot:false,note:"4.6 rec/G"},
      {rank:7,name:"A. Cooper",   team:"CLE",val:"61",hot:false,note:"4.4 rec/G"},
      {rank:8,name:"D. Samuel",   team:"SF", val:"58",hot:false,note:"4.1 rec/G"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"54",hot:false,note:"3.9 rec/G"},
      {rank:10,name:"D. Metcalf", team:"SEA",val:"51",hot:false,note:"3.6 rec/G"},
    ],
    "Targets":[
      {rank:1,name:"S. Diggs",    team:"BUF",val:"118",hot:true, note:"8.4/G — elite share"},
      {rank:2,name:"T. Hill",     team:"MIA",val:"112",hot:true, note:"8.0/G — deep threat"},
      {rank:3,name:"C. Lamb",     team:"DAL",val:"108",hot:false,note:"7.7/G — WR1 usage"},
      {rank:4,name:"J. Chase",    team:"CIN",val:"98", hot:true, note:"7.0/G — alpha"},
      {rank:5,name:"D. Adams",    team:"LV", val:"94", hot:false,note:"6.7/G — heavy usage"},
      {rank:6,name:"A. Cooper",   team:"CLE",val:"88", hot:false,note:"6.3/G — consistent"},
      {rank:7,name:"A. St. Brown",team:"DET",val:"84", hot:false,note:"6.0/G — slot heavy"},
      {rank:8,name:"D. Samuel",   team:"SF", val:"81", hot:false,note:"5.8/G — multi-role"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"78", hot:false,note:"5.6/G — high volume"},
      {rank:10,name:"D. Metcalf", team:"SEA",val:"74", hot:false,note:"5.3/G — big play"},
    ],
    "TDs":[
      {rank:1,name:"J. Chase",    team:"CIN",val:"11",hot:true, note:"Red zone target"},
      {rank:2,name:"T. Hill",     team:"MIA",val:"10",hot:true, note:"Speed TD"},
      {rank:3,name:"S. Diggs",    team:"BUF",val:"9", hot:false,note:"Volume TD"},
      {rank:4,name:"C. Lamb",     team:"DAL",val:"8", hot:false,note:"Reliable scorer"},
      {rank:5,name:"D. Metcalf",  team:"SEA",val:"8", hot:false,note:"Jump ball"},
      {rank:6,name:"D. Adams",    team:"LV", val:"7", hot:false,note:"Contested"},
      {rank:7,name:"A. St. Brown",team:"DET",val:"7", hot:false,note:"Slot TD"},
      {rank:8,name:"A. Cooper",   team:"CLE",val:"6", hot:false,note:"Steady"},
      {rank:9,name:"D. Samuel",   team:"SF", val:"6", hot:false,note:"Versatile"},
      {rank:10,name:"T. McLaurin",team:"WAS",val:"5", hot:false,note:"Improving"},
    ],
    "Yards/Rec":[
      {rank:1,name:"D. Metcalf",  team:"SEA",val:"17.8",hot:false,note:"Big play"},
      {rank:2,name:"T. Hill",     team:"MIA",val:"17.2",hot:true, note:"Speed routes"},
      {rank:3,name:"J. Chase",    team:"CIN",val:"16.8",hot:true, note:"Route runner"},
      {rank:4,name:"D. Adams",    team:"LV", val:"15.4",hot:false,note:"YAC machine"},
      {rank:5,name:"T. McLaurin", team:"WAS",val:"15.1",hot:false,note:"Separation"},
      {rank:6,name:"A. Cooper",   team:"CLE",val:"14.8",hot:false,note:"Crisp routes"},
      {rank:7,name:"D. Samuel",   team:"SF", val:"14.4",hot:false,note:"After catch"},
      {rank:8,name:"C. Lamb",     team:"DAL",val:"13.8",hot:false,note:"Possession"},
      {rank:9,name:"S. Diggs",    team:"BUF",val:"13.4",hot:false,note:"Reliable"},
      {rank:10,name:"A. St. Brown",team:"DET",val:"10.8",hot:false,note:"Slot role"},
    ],
    "Target%":[
      {rank:1,name:"S. Diggs",    team:"BUF",val:"28.4%",hot:true, note:"Dominant usage"},
      {rank:2,name:"T. Hill",     team:"MIA",val:"26.8%",hot:true, note:"Alpha target"},
      {rank:3,name:"C. Lamb",     team:"DAL",val:"24.4%",hot:false,note:"Clear WR1"},
      {rank:4,name:"J. Chase",    team:"CIN",val:"22.8%",hot:true, note:"Go-to target"},
      {rank:5,name:"D. Adams",    team:"LV", val:"21.4%",hot:false,note:"Heavy reliance"},
      {rank:6,name:"A. St. Brown",team:"DET",val:"20.8%",hot:false,note:"Slot volume"},
      {rank:7,name:"A. Cooper",   team:"CLE",val:"20.1%",hot:false,note:"WR1 role"},
      {rank:8,name:"D. Samuel",   team:"SF", val:"18.8%",hot:false,note:"Versatile"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"18.4%",hot:false,note:"Rising"},
      {rank:10,name:"D. Metcalf", team:"SEA",val:"17.8%",hot:false,note:"Big play"},
    ],
  },
  DEF:{
    "Sacks":[
      {rank:1,name:"M. Parsons",  team:"DAL",val:"14.5",hot:true, note:"DPOY candidate"},
      {rank:2,name:"T. Watt",     team:"PIT",val:"13.0",hot:true, note:"Elite edge"},
      {rank:3,name:"R. Anderson", team:"CAR",val:"11.5",hot:false,note:"Pass rush"},
      {rank:4,name:"K. Clark",    team:"GB", val:"10.5",hot:false,note:"Interior"},
      {rank:5,name:"M. Sweat",    team:"CHI",val:"9.5", hot:false,note:"Speed rusher"},
      {rank:6,name:"J. Hughes",   team:"BUF",val:"9.0", hot:false,note:"Veteran"},
      {rank:7,name:"B. Burns",    team:"CAR",val:"8.5", hot:false,note:"Improving"},
      {rank:8,name:"M. Judon",    team:"NE", val:"8.0", hot:false,note:"Consistent"},
      {rank:9,name:"H. Reddick",  team:"PHI",val:"7.5", hot:false,note:"Speed"},
      {rank:10,name:"D. Hendrickson",team:"CIN",val:"7.0",hot:false,note:"Steady"},
    ],
    "INT":[
      {rank:1,name:"D. King",     team:"DAL",val:"6",hot:true, note:"Ball hawk"},
      {rank:2,name:"T. Diggs",    team:"DAL",val:"5",hot:false,note:"Zone specialist"},
      {rank:3,name:"J. Ramsey",   team:"LAR",val:"5",hot:false,note:"Elite CB"},
      {rank:4,name:"A. Tagoailoa",team:"MIA",val:"4",hot:false,note:"Active zone"},
      {rank:5,name:"M. Williams", team:"PIT",val:"4",hot:false,note:"Veteran safety"},
      {rank:6,name:"X. McKinney",team:"NYG", val:"4",hot:false,note:"Improving"},
      {rank:7,name:"K. Fuller",   team:"CHI",val:"3",hot:false,note:"Press corner"},
      {rank:8,name:"J. Poyer",    team:"BUF",val:"3",hot:false,note:"Safety"},
      {rank:9,name:"D. White",    team:"TB", val:"3",hot:false,note:"Zone"},
      {rank:10,name:"M. Peters",  team:"BAL",val:"3",hot:false,note:"Veteran"},
    ],
    "Tackles":[
      {rank:1,name:"D. White",    team:"TB", val:"118",hot:false,note:"Volume LB"},
      {rank:2,name:"F. Warner",   team:"SF", val:"112",hot:false,note:"Elite LB"},
      {rank:3,name:"Q. Williams", team:"NYJ",val:"108",hot:false,note:"Run stuffer"},
      {rank:4,name:"Z. Cunningham",team:"HOU",val:"104",hot:false,note:"Sideline-to"},
      {rank:5,name:"T. Edmunds",  team:"CHI",val:"98", hot:false,note:"Safety/LB"},
      {rank:6,name:"J. Owusu-Koramoah",team:"CLE",val:"94",hot:false,note:"Speed"},
      {rank:7,name:"L. David",    team:"TB", val:"91", hot:false,note:"Captain"},
      {rank:8,name:"D. Leonard",  team:"IND",val:"88", hot:false,note:"Returning"},
      {rank:9,name:"B. Martinez", team:"NYG",val:"84", hot:false,note:"Consistent"},
      {rank:10,name:"A. Walker",  team:"TEN",val:"81", hot:false,note:"Solid"},
    ],
    "PD":[
      {rank:1,name:"J. Ramsey",   team:"LAR",val:"14",hot:false,note:"Shutdown CB"},
      {rank:2,name:"T. Diggs",    team:"DAL",val:"12",hot:false,note:"Zone"},
      {rank:3,name:"D. King",     team:"DAL",val:"11",hot:true, note:"Ball hawk"},
      {rank:4,name:"K. Fuller",   team:"CHI",val:"10",hot:false,note:"Press"},
      {rank:5,name:"M. Peters",   team:"BAL",val:"9", hot:false,note:"Veteran"},
      {rank:6,name:"X. McKinney",team:"NYG", val:"9", hot:false,note:"Safety"},
      {rank:7,name:"J. Poyer",    team:"BUF",val:"8", hot:false,note:"Zone"},
      {rank:8,name:"A. Tagoailoa",team:"MIA",val:"8", hot:false,note:"Active"},
      {rank:9,name:"D. White",    team:"TB", val:"7", hot:false,note:"LB/Zone"},
      {rank:10,name:"M. Williams",team:"PIT",val:"7", hot:false,note:"Safety"},
    ],
    "FF":[
      {rank:1,name:"T. Watt",     team:"PIT",val:"5",hot:true, note:"Strip specialist"},
      {rank:2,name:"M. Parsons",  team:"DAL",val:"4",hot:true, note:"Pressure machine"},
      {rank:3,name:"B. Burns",    team:"CAR",val:"3",hot:false,note:"Speed rush"},
      {rank:4,name:"R. Anderson", team:"CAR",val:"3",hot:false,note:"Bull rush"},
      {rank:5,name:"M. Judon",    team:"NE", val:"3",hot:false,note:"Veteran"},
      {rank:6,name:"J. Hughes",   team:"BUF",val:"2",hot:false,note:"Power"},
      {rank:7,name:"K. Clark",    team:"GB", val:"2",hot:false,note:"Interior"},
      {rank:8,name:"H. Reddick",  team:"PHI",val:"2",hot:false,note:"Speed"},
      {rank:9,name:"M. Sweat",    team:"CHI",val:"2",hot:false,note:"Disruptive"},
      {rank:10,name:"D. Hendrickson",team:"CIN",val:"1",hot:false,note:"Solid"},
    ],
    "TFL":[
      {rank:1,name:"M. Parsons",  team:"DAL",val:"18",hot:true, note:"Disruptive"},
      {rank:2,name:"T. Watt",     team:"PIT",val:"16",hot:true, note:"Backfield wrecker"},
      {rank:3,name:"F. Warner",   team:"SF", val:"14",hot:false,note:"LB range"},
      {rank:4,name:"Q. Williams", team:"NYJ",val:"13",hot:false,note:"NT impact"},
      {rank:5,name:"K. Clark",    team:"GB", val:"12",hot:false,note:"Interior"},
      {rank:6,name:"R. Anderson", team:"CAR",val:"11",hot:false,note:"Edge"},
      {rank:7,name:"B. Burns",    team:"CAR",val:"10",hot:false,note:"Improving"},
      {rank:8,name:"M. Sweat",    team:"CHI",val:"9", hot:false,note:"Speed"},
      {rank:9,name:"J. Hughes",   team:"BUF",val:"8", hot:false,note:"Veteran"},
      {rank:10,name:"M. Judon",   team:"NE", val:"8", hot:false,note:"Consistent"},
    ],
  },
  bet_QB:{
    "Pass Yds Props":[
      {rank:1,name:"P. Mahomes",  team:"KC", val:"72%",rec:"19-7", hot:true, note:"Hits 280+ at 72%"},
      {rank:2,name:"J. Burrow",   team:"CIN",val:"68%",rec:"18-8", hot:true, note:"High floor vs most D"},
      {rank:3,name:"L. Jackson",  team:"BAL",val:"64%",rec:"17-9", hot:false,note:"Volume when running"},
      {rank:4,name:"J. Hurts",    team:"PHI",val:"61%",rec:"16-10",hot:false,note:"Passes when needed"},
      {rank:5,name:"J. Allen",    team:"BUF",val:"58%",rec:"15-11",hot:false,note:"High variance"},
      {rank:6,name:"T. Lawrence", team:"JAX",val:"54%",rec:"14-12",hot:false,note:"Boom or bust"},
      {rank:7,name:"J. Goff",     team:"DET",val:"52%",rec:"13-12",hot:false,note:"Game script risk"},
      {rank:8,name:"B. Purdy",    team:"SF", val:"50%",rec:"13-13",hot:false,note:"System limits ceiling"},
      {rank:9,name:"D. Prescott", team:"DAL",val:"44%",rec:"11-14",hot:false,note:"OL issues hurt volume"},
      {rank:10,name:"K. Murray",  team:"ARI",val:"41%",rec:"10-14",hot:false,note:"Inconsistent"},
    ],
    "TD Props":[
      {rank:1,name:"P. Mahomes",  team:"KC", val:"69%",rec:"18-8", hot:true, note:"2+ TD in 69% of games"},
      {rank:2,name:"L. Jackson",  team:"BAL",val:"66%",rec:"17-9", hot:true, note:"Pass+rush TDs"},
      {rank:3,name:"J. Burrow",   team:"CIN",val:"63%",rec:"16-10",hot:false,note:"Reliable scorer"},
      {rank:4,name:"J. Hurts",    team:"PHI",val:"59%",rec:"15-11",hot:false,note:"Dual threat"},
      {rank:5,name:"J. Allen",    team:"BUF",val:"56%",rec:"14-11",hot:false,note:"Volume driven"},
      {rank:6,name:"T. Lawrence", team:"JAX",val:"48%",rec:"12-13",hot:false,note:"Volatile"},
      {rank:7,name:"J. Goff",     team:"DET",val:"46%",rec:"12-14",hot:false,note:"Game script"},
      {rank:8,name:"B. Purdy",    team:"SF", val:"44%",rec:"11-14",hot:false,note:"Limited upside"},
      {rank:9,name:"D. Prescott", team:"DAL",val:"41%",rec:"10-14",hot:false,note:"Struggling"},
      {rank:10,name:"K. Murray",  team:"ARI",val:"38%",rec:"9-14", hot:false,note:"Inconsistent"},
    ],
    "Rush Yds Props":[
      {rank:1,name:"L. Jackson",  team:"BAL",val:"74%",rec:"20-7", hot:true, note:"58.5+ O/U — high floor"},
      {rank:2,name:"J. Hurts",    team:"PHI",val:"66%",rec:"17-9", hot:false,note:"44.5 O/U — reliable"},
      {rank:3,name:"J. Allen",    team:"BUF",val:"54%",rec:"14-12",hot:false,note:"24.5 O/U — run-heavy"},
      {rank:4,name:"P. Mahomes",  team:"KC", val:"48%",rec:"12-13",hot:false,note:"Low line — occasional"},
      {rank:5,name:"K. Murray",   team:"ARI",val:"46%",rec:"12-14",hot:false,note:"Run-pass split"},
      {rank:6,name:"T. Lawrence", team:"JAX",val:"44%",rec:"11-14",hot:false,note:"Scramble dependent"},
      {rank:7,name:"J. Burrow",   team:"CIN",val:"42%",rec:"11-15",hot:false,note:"Low floor"},
      {rank:8,name:"J. Goff",     team:"DET",val:"36%",rec:"9-16", hot:false,note:"Pocket QB"},
      {rank:9,name:"B. Purdy",    team:"SF", val:"34%",rec:"9-17", hot:false,note:"Minimal rush"},
      {rank:10,name:"D. Prescott",team:"DAL",val:"32%",rec:"8-17", hot:false,note:"Sack risk"},
    ],
    "INT Props":[
      {rank:1,name:"D. Prescott", team:"DAL",val:"61%",rec:"16-10",hot:false,note:"0.5+ INT in 61% of G"},
      {rank:2,name:"K. Murray",   team:"ARI",val:"58%",rec:"15-11",hot:false,note:"Risk taker"},
      {rank:3,name:"T. Lawrence", team:"JAX",val:"54%",rec:"14-12",hot:false,note:"Volatile"},
      {rank:4,name:"J. Allen",    team:"BUF",val:"48%",rec:"12-13",hot:false,note:"Gunslinger"},
      {rank:5,name:"J. Burrow",   team:"CIN",val:"42%",rec:"11-15",hot:false,note:"Improving"},
      {rank:6,name:"J. Goff",     team:"DET",val:"38%",rec:"10-16",hot:false,note:"Safe reads"},
      {rank:7,name:"L. Jackson",  team:"BAL",val:"34%",rec:"9-17", hot:false,note:"Low INT rate"},
      {rank:8,name:"J. Hurts",    team:"PHI",val:"32%",rec:"8-17", hot:false,note:"Smart QB"},
      {rank:9,name:"B. Purdy",    team:"SF", val:"28%",rec:"7-18", hot:false,note:"Careful"},
      {rank:10,name:"P. Mahomes", team:"KC", val:"24%",rec:"6-20", hot:false,note:"Elite decisions"},
    ],
  },
  bet_RB:{
    "Rush Yds Props":[
      {rank:1,name:"D. Henry",    team:"TEN",val:"71%",rec:"19-8", hot:true, note:"74.5+ O/U — workhorse"},
      {rank:2,name:"C. McCaffrey",team:"SF", val:"68%",rec:"18-8", hot:true, note:"68.5+ O/U — dual threat"},
      {rank:3,name:"J. Gibbs",    team:"DET",val:"64%",rec:"17-10",hot:true, note:"62.5+ O/U — explosive"},
      {rank:4,name:"B. Robinson",team:"ATL", val:"58%",rec:"15-11",hot:false,note:"Workhorse volume"},
      {rank:5,name:"T. Pollard",  team:"TEN",val:"54%",rec:"14-12",hot:false,note:"Speed dependent"},
      {rank:6,name:"A. Jones",    team:"MIN",val:"50%",rec:"13-13",hot:false,note:"Even split"},
      {rank:7,name:"K. Williams", team:"LAC",val:"48%",rec:"12-13",hot:false,note:"Explosive but risky"},
      {rank:8,name:"R. Stevenson",team:"NE", val:"44%",rec:"11-14",hot:false,note:"Negative game scripts"},
      {rank:9,name:"J. Jacobs",   team:"LV", val:"41%",rec:"10-14",hot:false,note:"OL struggles"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"38%",rec:"9-14", hot:false,note:"Limited upside"},
    ],
    "Rec Props":[
      {rank:1,name:"C. McCaffrey",team:"SF", val:"74%",rec:"20-7", hot:true, note:"3.5+ rec — elite floor"},
      {rank:2,name:"J. Gibbs",    team:"DET",val:"68%",rec:"18-8", hot:true, note:"2.5+ rec — consistent"},
      {rank:3,name:"T. Pollard",  team:"TEN",val:"61%",rec:"16-10",hot:false,note:"Pass down back"},
      {rank:4,name:"A. Jones",    team:"MIN",val:"56%",rec:"14-11",hot:false,note:"Check down"},
      {rank:5,name:"K. Williams", team:"LAC",val:"52%",rec:"13-12",hot:false,note:"Spot role"},
      {rank:6,name:"J. Jacobs",   team:"LV", val:"48%",rec:"12-13",hot:false,note:"Limited target share"},
      {rank:7,name:"B. Robinson",team:"ATL", val:"44%",rec:"11-14",hot:false,note:"Run-first scheme"},
      {rank:8,name:"R. Stevenson",team:"NE", val:"41%",rec:"10-14",hot:false,note:"Blocking role"},
      {rank:9,name:"D. Henry",    team:"TEN",val:"38%",rec:"9-14", hot:false,note:"Power back"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"34%",rec:"8-15", hot:false,note:"Minimal targets"},
    ],
    "TD Props":[
      {rank:1,name:"D. Henry",    team:"TEN",val:"58%",rec:"15-11",hot:true, note:"Goal line carry"},
      {rank:2,name:"C. McCaffrey",team:"SF", val:"54%",rec:"14-12",hot:false,note:"Multiple paths"},
      {rank:3,name:"J. Gibbs",    team:"DET",val:"51%",rec:"13-12",hot:false,note:"Goal line share"},
      {rank:4,name:"B. Robinson",team:"ATL", val:"46%",rec:"12-14",hot:false,note:"Short yardage"},
      {rank:5,name:"T. Pollard",  team:"TEN",val:"42%",rec:"11-15",hot:false,note:"Speed TD"},
      {rank:6,name:"A. Jones",    team:"MIN",val:"38%",rec:"9-15", hot:false,note:"Splitting role"},
      {rank:7,name:"K. Williams", team:"LAC",val:"36%",rec:"9-16", hot:false,note:"Explosive"},
      {rank:8,name:"J. Jacobs",   team:"LV", val:"34%",rec:"8-16", hot:false,note:"Volume needed"},
      {rank:9,name:"R. Stevenson",team:"NE", val:"31%",rec:"8-18", hot:false,note:"Low floor"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"28%",rec:"7-18", hot:false,note:"Limited usage"},
    ],
    "Carries Props":[
      {rank:1,name:"D. Henry",    team:"TEN",val:"76%",rec:"21-7", hot:true, note:"18+ carries — workhorse"},
      {rank:2,name:"B. Robinson",team:"ATL", val:"68%",rec:"18-8", hot:false,note:"High volume"},
      {rank:3,name:"C. McCaffrey",team:"SF", val:"64%",rec:"17-9", hot:false,note:"Consistent touches"},
      {rank:4,name:"J. Gibbs",    team:"DET",val:"58%",rec:"15-11",hot:false,note:"Explosive role"},
      {rank:5,name:"A. Jones",    team:"MIN",val:"52%",rec:"13-12",hot:false,note:"Feature back"},
      {rank:6,name:"J. Jacobs",   team:"LV", val:"48%",rec:"12-13",hot:false,note:"Heavy load"},
      {rank:7,name:"T. Pollard",  team:"TEN",val:"44%",rec:"11-14",hot:false,note:"Split backfield"},
      {rank:8,name:"R. Stevenson",team:"NE", val:"41%",rec:"10-14",hot:false,note:"Game script"},
      {rank:9,name:"K. Williams", team:"LAC",val:"38%",rec:"9-14", hot:false,note:"Explosive-only"},
      {rank:10,name:"J. Warren",  team:"PIT",val:"34%",rec:"8-15", hot:false,note:"Backup role"},
    ],
  },
  bet_WR:{
    "Rec Yds Props":[
      {rank:1,name:"T. Hill",     team:"MIA",val:"74%",rec:"20-7", hot:true, note:"74.5+ O/U — elite"},
      {rank:2,name:"J. Chase",    team:"CIN",val:"71%",rec:"19-8", hot:true, note:"68.5+ — alpha"},
      {rank:3,name:"S. Diggs",    team:"BUF",val:"66%",rec:"17-9", hot:true, note:"64.5+ — volume"},
      {rank:4,name:"C. Lamb",     team:"DAL",val:"62%",rec:"16-10",hot:false,note:"Target share"},
      {rank:5,name:"D. Adams",    team:"LV", val:"56%",rec:"14-11",hot:false,note:"Usage dependent"},
      {rank:6,name:"A. Cooper",   team:"CLE",val:"52%",rec:"13-12",hot:false,note:"Steady"},
      {rank:7,name:"D. Samuel",   team:"SF", val:"49%",rec:"12-13",hot:false,note:"Role varies"},
      {rank:8,name:"D. Metcalf",  team:"SEA",val:"46%",rec:"12-14",hot:false,note:"Boom/bust"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"44%",rec:"11-14",hot:false,note:"QB dependent"},
      {rank:10,name:"A. St. Brown",team:"DET",val:"41%",rec:"10-14",hot:false,note:"Slot role"},
    ],
    "Reception Props":[
      {rank:1,name:"S. Diggs",    team:"BUF",val:"78%",rec:"21-6", hot:true, note:"4.5+ rec — volume king"},
      {rank:2,name:"C. Lamb",     team:"DAL",val:"72%",rec:"19-7", hot:false,note:"High target share"},
      {rank:3,name:"T. Hill",     team:"MIA",val:"68%",rec:"18-8", hot:true, note:"Short routes + targets"},
      {rank:4,name:"A. St. Brown",team:"DET",val:"64%",rec:"17-10",hot:false,note:"Slot volume"},
      {rank:5,name:"J. Chase",    team:"CIN",val:"61%",rec:"16-10",hot:false,note:"Routes + targets"},
      {rank:6,name:"D. Adams",    team:"LV", val:"56%",rec:"14-11",hot:false,note:"Usage"},
      {rank:7,name:"A. Cooper",   team:"CLE",val:"52%",rec:"13-12",hot:false,note:"Consistent"},
      {rank:8,name:"D. Samuel",   team:"SF", val:"48%",rec:"12-13",hot:false,note:"Versatile"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"44%",rec:"11-14",hot:false,note:"QB dependent"},
      {rank:10,name:"D. Metcalf", team:"SEA",val:"41%",rec:"10-14",hot:false,note:"Deep only"},
    ],
    "Target Props":[
      {rank:1,name:"S. Diggs",    team:"BUF",val:"81%",rec:"22-5", hot:true, note:"7+ targets — elite floor"},
      {rank:2,name:"T. Hill",     team:"MIA",val:"76%",rec:"20-6", hot:true, note:"6+ targets — volume"},
      {rank:3,name:"C. Lamb",     team:"DAL",val:"71%",rec:"19-8", hot:false,note:"Clear WR1 target share"},
      {rank:4,name:"J. Chase",    team:"CIN",val:"66%",rec:"17-9", hot:true, note:"Alpha route runner"},
      {rank:5,name:"D. Adams",    team:"LV", val:"61%",rec:"16-10",hot:false,note:"Heavy usage"},
      {rank:6,name:"A. St. Brown",team:"DET",val:"56%",rec:"14-11",hot:false,note:"Slot targets"},
      {rank:7,name:"A. Cooper",   team:"CLE",val:"52%",rec:"13-12",hot:false,note:"WR1 role"},
      {rank:8,name:"D. Samuel",   team:"SF", val:"48%",rec:"12-13",hot:false,note:"Multi-role"},
      {rank:9,name:"T. McLaurin", team:"WAS",val:"44%",rec:"11-14",hot:false,note:"Rising"},
      {rank:10,name:"D. Metcalf", team:"SEA",val:"41%",rec:"10-14",hot:false,note:"Deep threat only"},
    ],
    "TD Props":[
      {rank:1,name:"J. Chase",    team:"CIN",val:"54%",rec:"14-12",hot:true, note:"Anytime TD — red zone"},
      {rank:2,name:"T. Hill",     team:"MIA",val:"51%",rec:"13-12",hot:false,note:"Speed scorer"},
      {rank:3,name:"D. Metcalf",  team:"SEA",val:"48%",rec:"12-13",hot:false,note:"Jump ball"},
      {rank:4,name:"S. Diggs",    team:"BUF",val:"44%",rec:"11-14",hot:false,note:"Volume TD"},
      {rank:5,name:"C. Lamb",     team:"DAL",val:"41%",rec:"10-14",hot:false,note:"Reliable"},
      {rank:6,name:"D. Adams",    team:"LV", val:"38%",rec:"9-14", hot:false,note:"Contested"},
      {rank:7,name:"A. St. Brown",team:"DET",val:"36%",rec:"9-16", hot:false,note:"Slot TD"},
      {rank:8,name:"A. Cooper",   team:"CLE",val:"34%",rec:"8-16", hot:false,note:"Steady"},
      {rank:9,name:"D. Samuel",   team:"SF", val:"31%",rec:"8-18", hot:false,note:"Versatile"},
      {rank:10,name:"T. McLaurin",team:"WAS",val:"28%",rec:"7-18", hot:false,note:"Improving"},
    ],
  },
  TE:{
    "Rec Yds":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"984",hot:true, note:"74 avg/G — GOAT TE"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"848",hot:true, note:"64 avg/G — rising star"},
      {rank:3,name:"D. Kittle",   team:"SF", val:"812",hot:false,note:"62 avg/G — elite"},
      {rank:4,name:"M. Andrews",  team:"BAL",val:"784",hot:false,note:"61 avg/G — Lamar target"},
      {rank:5,name:"D. Waller",   team:"NYG",val:"714",hot:false,note:"55 avg/G"},
      {rank:6,name:"E. Engram",   team:"JAX",val:"684",hot:false,note:"53 avg/G"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"648",hot:false,note:"50 avg/G"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"612",hot:false,note:"47 avg/G"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"584",hot:false,note:"45 avg/G"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"548",hot:false,note:"42 avg/G"},
    ],
    "Receptions":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"74",hot:true, note:"5.7 rec/G"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"68",hot:true, note:"5.2 rec/G"},
      {rank:3,name:"D. Kittle",   team:"SF", val:"61",hot:false,note:"4.7 rec/G"},
      {rank:4,name:"E. Engram",   team:"JAX",val:"58",hot:false,note:"4.5 rec/G"},
      {rank:5,name:"M. Andrews",  team:"BAL",val:"54",hot:false,note:"4.2 rec/G"},
      {rank:6,name:"D. Waller",   team:"NYG",val:"51",hot:false,note:"3.9 rec/G"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"48",hot:false,note:"3.7 rec/G"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"44",hot:false,note:"3.4 rec/G"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"41",hot:false,note:"3.2 rec/G"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"38",hot:false,note:"2.9 rec/G"},
    ],
    "Targets":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"98",hot:true, note:"7.5/G — elite usage"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"88",hot:true, note:"6.8/G — rising"},
      {rank:3,name:"E. Engram",   team:"JAX",val:"81",hot:false,note:"6.2/G — volume"},
      {rank:4,name:"D. Kittle",   team:"SF", val:"78",hot:false,note:"6.0/G — scheme"},
      {rank:5,name:"M. Andrews",  team:"BAL",val:"74",hot:false,note:"5.7/G — Lamar fave"},
      {rank:6,name:"D. Waller",   team:"NYG",val:"68",hot:false,note:"5.2/G"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"64",hot:false,note:"4.9/G"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"58",hot:false,note:"4.5/G"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"54",hot:false,note:"4.2/G"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"48",hot:false,note:"3.7/G"},
    ],
    "TDs":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"9", hot:true, note:"Red zone staple"},
      {rank:2,name:"D. Kittle",   team:"SF", val:"8", hot:false,note:"Seam routes"},
      {rank:3,name:"S. LaPorta",  team:"DET",val:"7", hot:true, note:"Rising"},
      {rank:4,name:"M. Andrews",  team:"BAL",val:"6", hot:false,note:"Reliable"},
      {rank:5,name:"D. Waller",   team:"NYG",val:"5", hot:false,note:"Big slot"},
      {rank:6,name:"E. Engram",   team:"JAX",val:"5", hot:false,note:"Volume TD"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"4", hot:false,note:"Improving"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"4", hot:false,note:"Solid"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"3", hot:false,note:"Consistent"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"3", hot:false,note:"Steady"},
    ],
    "Yards/Rec":[
      {rank:1,name:"D. Kittle",   team:"SF", val:"14.2",hot:false,note:"YAC machine"},
      {rank:2,name:"D. Waller",   team:"NYG",val:"13.8",hot:false,note:"Big slot"},
      {rank:3,name:"M. Andrews",  team:"BAL",val:"13.4",hot:false,note:"Seam routes"},
      {rank:4,name:"T. Kelce",    team:"KC", val:"13.1",hot:true, note:"Route runner"},
      {rank:5,name:"S. LaPorta",  team:"DET",val:"12.8",hot:false,note:"After catch"},
      {rank:6,name:"I. Thomas",   team:"WAS",val:"12.4",hot:false,note:"Athletic"},
      {rank:7,name:"P. Freiermuth",team:"PIT",val:"11.8",hot:false,note:"Solid"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"11.4",hot:false,note:"Reliable"},
      {rank:9,name:"E. Engram",   team:"JAX",val:"11.1",hot:false,note:"Quickness"},
      {rank:10,name:"C. Kmet",    team:"CHI",val:"10.8",hot:false,note:"Slot role"},
    ],
    "Target%":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"24.8%",hot:true, note:"Dominant share"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"22.4%",hot:true, note:"Rising alpha"},
      {rank:3,name:"E. Engram",   team:"JAX",val:"20.8%",hot:false,note:"Heavy usage"},
      {rank:4,name:"D. Kittle",   team:"SF", val:"19.4%",hot:false,note:"Scheme driven"},
      {rank:5,name:"M. Andrews",  team:"BAL",val:"18.8%",hot:false,note:"Key target"},
      {rank:6,name:"D. Waller",   team:"NYG",val:"17.4%",hot:false,note:"Big slot"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"16.8%",hot:false,note:"Improving"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"15.4%",hot:false,note:"Solid"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"14.8%",hot:false,note:"Consistent"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"13.4%",hot:false,note:"Role"},
    ],
  },
  bet_TE:{
    "Rec Yds Props":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"74%",rec:"20-7", hot:true, note:"58.5+ O/U — elite floor"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"68%",rec:"18-8", hot:true, note:"44.5+ — rising fast"},
      {rank:3,name:"D. Kittle",   team:"SF", val:"64%",rec:"17-9", hot:false,note:"42.5+ — scheme dependent"},
      {rank:4,name:"M. Andrews",  team:"BAL",val:"58%",rec:"15-11",hot:false,note:"38.5+ — Lamar boosts"},
      {rank:5,name:"E. Engram",   team:"JAX",val:"52%",rec:"13-12",hot:false,note:"Volume"},
      {rank:6,name:"D. Waller",   team:"NYG",val:"48%",rec:"12-13",hot:false,note:"Matchup dependent"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"44%",rec:"11-14",hot:false,note:"QB limits"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"41%",rec:"10-14",hot:false,note:"Volatile"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"38%",rec:"9-14", hot:false,note:"Steady"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"34%",rec:"8-15", hot:false,note:"Improving"},
    ],
    "Reception Props":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"78%",rec:"21-6", hot:true, note:"4.5+ rec — elite"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"71%",rec:"19-8", hot:true, note:"3.5+ rec — rising"},
      {rank:3,name:"E. Engram",   team:"JAX",val:"64%",rec:"17-9", hot:false,note:"High volume"},
      {rank:4,name:"D. Kittle",   team:"SF", val:"61%",rec:"16-10",hot:false,note:"Scheme usage"},
      {rank:5,name:"M. Andrews",  team:"BAL",val:"56%",rec:"14-11",hot:false,note:"Consistent"},
      {rank:6,name:"D. Waller",   team:"NYG",val:"51%",rec:"13-12",hot:false,note:"Even split"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"46%",rec:"12-14",hot:false,note:"Improving"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"42%",rec:"11-15",hot:false,note:"Volatile"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"38%",rec:"9-14", hot:false,note:"Steady"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"34%",rec:"8-15", hot:false,note:"Improving"},
    ],
    "Target Props":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"82%",rec:"22-5", hot:true, note:"6+ targets — floor"},
      {rank:2,name:"S. LaPorta",  team:"DET",val:"74%",rec:"20-7", hot:true, note:"5+ targets — rising"},
      {rank:3,name:"E. Engram",   team:"JAX",val:"68%",rec:"18-8", hot:false,note:"Heavy usage"},
      {rank:4,name:"D. Kittle",   team:"SF", val:"62%",rec:"16-10",hot:false,note:"Scheme"},
      {rank:5,name:"M. Andrews",  team:"BAL",val:"58%",rec:"15-11",hot:false,note:"Key target"},
      {rank:6,name:"D. Waller",   team:"NYG",val:"52%",rec:"13-12",hot:false,note:"Big slot"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"46%",rec:"12-14",hot:false,note:"Growing"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"41%",rec:"10-14",hot:false,note:"Volatile"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"38%",rec:"9-14", hot:false,note:"Steady"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"34%",rec:"8-15", hot:false,note:"Rising"},
    ],
    "TD Props":[
      {rank:1,name:"T. Kelce",    team:"KC", val:"56%",rec:"15-12",hot:true, note:"Anytime TD — red zone"},
      {rank:2,name:"D. Kittle",   team:"SF", val:"51%",rec:"13-12",hot:false,note:"Seam TD"},
      {rank:3,name:"S. LaPorta",  team:"DET",val:"46%",rec:"12-14",hot:false,note:"Rising"},
      {rank:4,name:"M. Andrews",  team:"BAL",val:"42%",rec:"11-15",hot:false,note:"Reliable"},
      {rank:5,name:"D. Waller",   team:"NYG",val:"38%",rec:"9-14", hot:false,note:"Big slot"},
      {rank:6,name:"E. Engram",   team:"JAX",val:"34%",rec:"9-17", hot:false,note:"Volume TD"},
      {rank:7,name:"C. Kmet",     team:"CHI",val:"31%",rec:"8-18", hot:false,note:"Improving"},
      {rank:8,name:"D. Schultz",  team:"HOU",val:"28%",rec:"7-18", hot:false,note:"Solid"},
      {rank:9,name:"P. Freiermuth",team:"PIT",val:"24%",rec:"6-19",hot:false,note:"Low floor"},
      {rank:10,name:"I. Thomas",  team:"WAS",val:"21%",rec:"5-19", hot:false,note:"Improving"},
    ],
  },

  bet_DEF:{
    "Sack Props":[
      {rank:1,name:"M. Parsons",  team:"DAL",val:"68%",rec:"18-8", hot:true, note:"0.5+ sack — dominant"},
      {rank:2,name:"T. Watt",     team:"PIT",val:"64%",rec:"17-9", hot:true, note:"Elite edge"},
      {rank:3,name:"R. Anderson", team:"CAR",val:"56%",rec:"14-11",hot:false,note:"Consistent"},
      {rank:4,name:"K. Clark",    team:"GB", val:"52%",rec:"13-12",hot:false,note:"Interior"},
      {rank:5,name:"M. Sweat",    team:"CHI",val:"48%",rec:"12-13",hot:false,note:"Speed"},
      {rank:6,name:"J. Hughes",   team:"BUF",val:"44%",rec:"11-14",hot:false,note:"Veteran"},
      {rank:7,name:"B. Burns",    team:"CAR",val:"41%",rec:"10-14",hot:false,note:"Improving"},
      {rank:8,name:"M. Judon",    team:"NE", val:"38%",rec:"9-14", hot:false,note:"Consistent"},
      {rank:9,name:"H. Reddick",  team:"PHI",val:"36%",rec:"9-16", hot:false,note:"Speed"},
      {rank:10,name:"D. Hendrickson",team:"CIN",val:"33%",rec:"8-16",hot:false,note:"Steady"},
    ],
    "Tackle Props":[
      {rank:1,name:"F. Warner",   team:"SF", val:"72%",rec:"19-8", hot:false,note:"5.5+ tackles"},
      {rank:2,name:"D. White",    team:"TB", val:"68%",rec:"18-8", hot:false,note:"Volume LB"},
      {rank:3,name:"Q. Williams", team:"NYJ",val:"64%",rec:"17-10",hot:false,note:"Run stuffing"},
      {rank:4,name:"Z. Cunningham",team:"HOU",val:"58%",rec:"15-11",hot:false,note:"Active"},
      {rank:5,name:"L. David",    team:"TB", val:"54%",rec:"14-12",hot:false,note:"Captain"},
      {rank:6,name:"T. Edmunds",  team:"CHI",val:"50%",rec:"13-13",hot:false,note:"Box safety"},
      {rank:7,name:"J. Owusu-Koramoah",team:"CLE",val:"46%",rec:"12-14",hot:false,note:"Speed"},
      {rank:8,name:"D. Leonard",  team:"IND",val:"42%",rec:"11-15",hot:false,note:"Returning"},
      {rank:9,name:"B. Martinez", team:"NYG",val:"38%",rec:"9-14", hot:false,note:"Steady"},
      {rank:10,name:"A. Walker",  team:"TEN",val:"34%",rec:"8-15", hot:false,note:"Solid"},
    ],
    "INT Props":[
      {rank:1,name:"D. King",     team:"DAL",val:"44%",rec:"11-14",hot:true, note:"0.5+ INT — ball hawk"},
      {rank:2,name:"J. Ramsey",   team:"LAR",val:"38%",rec:"9-14", hot:false,note:"Press corner"},
      {rank:3,name:"T. Diggs",    team:"DAL",val:"36%",rec:"9-16", hot:false,note:"Zone"},
      {rank:4,name:"X. McKinney",team:"NYG", val:"33%",rec:"8-16", hot:false,note:"Safety"},
      {rank:5,name:"M. Peters",   team:"BAL",val:"31%",rec:"8-18", hot:false,note:"Veteran"},
      {rank:6,name:"K. Fuller",   team:"CHI",val:"28%",rec:"7-18", hot:false,note:"Press"},
      {rank:7,name:"J. Poyer",    team:"BUF",val:"26%",rec:"6-18", hot:false,note:"Zone"},
      {rank:8,name:"M. Williams", team:"PIT",val:"24%",rec:"6-20", hot:false,note:"Safety"},
      {rank:9,name:"A. Tagoailoa",team:"MIA",val:"22%",rec:"5-18", hot:false,note:"Active"},
      {rank:10,name:"D. White",   team:"TB", val:"19%",rec:"5-22", hot:false,note:"LB INT"},
    ],
  },
  NFL_Teams:{
    "Points/G":[
      {rank:1,name:"Kansas City Chiefs",    team:"KC", val:"31.4",hot:true, note:"Mahomes offense"},
      {rank:2,name:"San Francisco 49ers",   team:"SF", val:"29.8",hot:true, note:"Kyle Shanahan"},
      {rank:3,name:"Philadelphia Eagles",   team:"PHI",val:"28.6",hot:false,note:"Hurts + skill"},
      {rank:4,name:"Baltimore Ravens",      team:"BAL",val:"27.4",hot:true, note:"Lamar MVP pace"},
      {rank:5,name:"Detroit Lions",         team:"DET",val:"26.8",hot:false,note:"Goff breakout"},
      {rank:6,name:"Cincinnati Bengals",    team:"CIN",val:"26.2",hot:false,note:"Burrow healthy"},
      {rank:7,name:"Miami Dolphins",        team:"MIA",val:"25.8",hot:false,note:"Speed offense"},
      {rank:8,name:"Los Angeles Rams",      team:"LAR",val:"24.4",hot:false,note:"McVay creative"},
      {rank:9,name:"Buffalo Bills",         team:"BUF",val:"24.1",hot:false,note:"Allen led"},
      {rank:10,name:"Houston Texans",       team:"HOU",val:"23.8",hot:false,note:"Young core"},
    ],
    "Pass Yds/G":[
      {rank:1,name:"Miami Dolphins",        team:"MIA",val:"298",hot:false,note:"Speed routes"},
      {rank:2,name:"Kansas City Chiefs",    team:"KC", val:"284",hot:true, note:"Mahomes"},
      {rank:3,name:"Cincinnati Bengals",    team:"CIN",val:"278",hot:false,note:"Burrow"},
      {rank:4,name:"Philadelphia Eagles",   team:"PHI",val:"271",hot:false,note:"Balanced"},
      {rank:5,name:"Buffalo Bills",         team:"BUF",val:"268",hot:false,note:"Allen volume"},
      {rank:6,name:"Jacksonville Jaguars",  team:"JAX",val:"261",hot:false,note:"Lawrence"},
      {rank:7,name:"Dallas Cowboys",        team:"DAL",val:"254",hot:false,note:"Prescott"},
      {rank:8,name:"Detroit Lions",         team:"DET",val:"248",hot:false,note:"Goff"},
      {rank:9,name:"Los Angeles Rams",      team:"LAR",val:"244",hot:false,note:"Stafford"},
      {rank:10,name:"Baltimore Ravens",     team:"BAL",val:"238",hot:false,note:"Run-pass"},
    ],
    "Rush Yds/G":[
      {rank:1,name:"Baltimore Ravens",      team:"BAL",val:"164",hot:true, note:"Lamar + Henry"},
      {rank:2,name:"San Francisco 49ers",   team:"SF", val:"148",hot:false,note:"CMC + scheme"},
      {rank:3,name:"Detroit Lions",         team:"DET",val:"138",hot:false,note:"Gibbs + Henry"},
      {rank:4,name:"Tennessee Titans",      team:"TEN",val:"132",hot:false,note:"Henry era"},
      {rank:5,name:"Atlanta Falcons",       team:"ATL",val:"124",hot:false,note:"Robinson"},
      {rank:6,name:"Philadelphia Eagles",   team:"PHI",val:"118",hot:false,note:"Hurts + RBs"},
      {rank:7,name:"New England Patriots",  team:"NE", val:"112",hot:false,note:"Stevenson"},
      {rank:8,name:"Pittsburgh Steelers",   team:"PIT",val:"108",hot:false,note:"Warren"},
      {rank:9,name:"Minnesota Vikings",     team:"MIN",val:"104",hot:false,note:"Jones"},
      {rank:10,name:"Kansas City Chiefs",   team:"KC", val:"98", hot:false,note:"Balanced"},
    ],
    "Points Allowed/G":[
      {rank:1,name:"San Francisco 49ers",   team:"SF", val:"17.4",hot:true, note:"Elite D"},
      {rank:2,name:"Baltimore Ravens",      team:"BAL",val:"18.2",hot:false,note:"Strong unit"},
      {rank:3,name:"New England Patriots",  team:"NE", val:"18.8",hot:false,note:"Belichick D"},
      {rank:4,name:"Kansas City Chiefs",    team:"KC", val:"19.4",hot:false,note:"Spagnuolo"},
      {rank:5,name:"Cleveland Browns",      team:"CLE",val:"19.8",hot:false,note:"Myles D"},
      {rank:6,name:"Pittsburgh Steelers",   team:"PIT",val:"20.4",hot:false,note:"Watt led"},
      {rank:7,name:"Philadelphia Eagles",   team:"PHI",val:"20.8",hot:false,note:"Sirianni D"},
      {rank:8,name:"New York Jets",         team:"NYJ",val:"21.2",hot:false,note:"Saleh D"},
      {rank:9,name:"Dallas Cowboys",        team:"DAL",val:"21.8",hot:false,note:"Parsons led"},
      {rank:10,name:"Miami Dolphins",       team:"MIA",val:"22.4",hot:false,note:"Improving"},
    ],
    "Sacks":[
      {rank:1,name:"Dallas Cowboys",        team:"DAL",val:"52",hot:true, note:"Parsons + edge"},
      {rank:2,name:"Pittsburgh Steelers",   team:"PIT",val:"48",hot:true, note:"Watt + depth"},
      {rank:3,name:"San Francisco 49ers",   team:"SF", val:"44",hot:false,note:"Bosa led"},
      {rank:4,name:"Philadelphia Eagles",   team:"PHI",val:"41",hot:false,note:"Reddick"},
      {rank:5,name:"Carolina Panthers",     team:"CAR",val:"38",hot:false,note:"Burns + Anderson"},
      {rank:6,name:"Cleveland Browns",      team:"CLE",val:"36",hot:false,note:"Myles Garrett"},
      {rank:7,name:"Baltimore Ravens",      team:"BAL",val:"34",hot:false,note:"Strong front"},
      {rank:8,name:"Kansas City Chiefs",    team:"KC", val:"32",hot:false,note:"Spagnuolo"},
      {rank:9,name:"Buffalo Bills",         team:"BUF",val:"30",hot:false,note:"Hughes + Von"},
      {rank:10,name:"New York Jets",        team:"NYJ",val:"28",hot:false,note:"Young edge"},
    ],
    "Turnovers":[
      {rank:1,name:"Dallas Cowboys",        team:"DAL",val:"28",hot:false,note:"Most forced"},
      {rank:2,name:"San Francisco 49ers",   team:"SF", val:"26",hot:false,note:"Warner + DBs"},
      {rank:3,name:"Baltimore Ravens",      team:"BAL",val:"24",hot:false,note:"Peters + LBs"},
      {rank:4,name:"Kansas City Chiefs",    team:"KC", val:"22",hot:false,note:"Spagnuolo"},
      {rank:5,name:"Pittsburgh Steelers",   team:"PIT",val:"21",hot:false,note:"Watt strip"},
      {rank:6,name:"Miami Dolphins",        team:"MIA",val:"19",hot:false,note:"DB heavy"},
      {rank:7,name:"Philadelphia Eagles",   team:"PHI",val:"18",hot:false,note:"Reddick"},
      {rank:8,name:"New England Patriots",  team:"NE", val:"17",hot:false,note:"Scheme"},
      {rank:9,name:"Cleveland Browns",      team:"CLE",val:"16",hot:false,note:"Garrett"},
      {rank:10,name:"Buffalo Bills",        team:"BUF",val:"15",hot:false,note:"Secondary"},
    ],
  },
  bet_NFL_Teams:{
    ATS:[
      {rank:1,name:"Kansas City Chiefs",    team:"KC", val:"60%",rec:"21-14",hot:true, note:"Mahomes home dominant"},
      {rank:2,name:"Philadelphia Eagles",   team:"PHI",val:"58%",rec:"20-14",hot:true, note:"7-2 last 9"},
      {rank:3,name:"San Francisco 49ers",   team:"SF", val:"56%",rec:"19-15",hot:false,note:"Shanahan edge"},
      {rank:4,name:"Detroit Lions",         team:"DET",val:"54%",rec:"18-15",hot:false,note:"Undervalued"},
      {rank:5,name:"Baltimore Ravens",      team:"BAL",val:"52%",rec:"18-17",hot:false,note:"Lamar covers"},
      {rank:6,name:"Cincinnati Bengals",    team:"CIN",val:"50%",rec:"17-17",hot:false,note:"Even split"},
      {rank:7,name:"Houston Texans",        team:"HOU",val:"48%",rec:"16-18",hot:false,note:"Improving"},
      {rank:8,name:"Miami Dolphins",        team:"MIA",val:"46%",rec:"16-19",hot:false,note:"Volatile"},
      {rank:9,name:"Dallas Cowboys",        team:"DAL",val:"38%",rec:"13-21",hot:false,note:"Overvalued"},
      {rank:10,name:"New England Patriots", team:"NE", val:"34%",rec:"12-23",hot:false,note:"Rebuilding"},
    ],
    Over:[
      {rank:1,name:"Kansas City Chiefs",    team:"KC", val:"59%",rec:"20-14",hot:true, note:"High scoring games"},
      {rank:2,name:"Miami Dolphins",        team:"MIA",val:"56%",rec:"19-15",hot:false,note:"Speed offense"},
      {rank:3,name:"Cincinnati Bengals",    team:"CIN",val:"54%",rec:"18-15",hot:false,note:"Burrow shoots out"},
      {rank:4,name:"Detroit Lions",         team:"DET",val:"52%",rec:"18-17",hot:false,note:"Offensive fireworks"},
      {rank:5,name:"Philadelphia Eagles",   team:"PHI",val:"51%",rec:"17-17",hot:false,note:"High pace"},
      {rank:6,name:"Baltimore Ravens",      team:"BAL",val:"49%",rec:"17-18",hot:false,note:"Defense limits"},
      {rank:7,name:"Los Angeles Rams",      team:"LAR",val:"48%",rec:"16-18",hot:false,note:"McVay passes"},
      {rank:8,name:"Buffalo Bills",         team:"BUF",val:"46%",rec:"16-19",hot:false,note:"Allen boom/bust"},
      {rank:9,name:"San Francisco 49ers",   team:"SF", val:"44%",rec:"15-20",hot:false,note:"Defense suppresses"},
      {rank:10,name:"New England Patriots", team:"NE", val:"38%",rec:"13-22",hot:false,note:"Low scoring"},
    ],
    Under:[
      {rank:1,name:"San Francisco 49ers",   team:"SF", val:"56%",rec:"19-15",hot:true, note:"Defense dominant"},
      {rank:2,name:"Baltimore Ravens",      team:"BAL",val:"52%",rec:"18-17",hot:false,note:"Ball control"},
      {rank:3,name:"New England Patriots",  team:"NE", val:"62%",rec:"21-13",hot:false,note:"Low pace"},
      {rank:4,name:"Pittsburgh Steelers",   team:"PIT",val:"54%",rec:"18-15",hot:false,note:"Defense led"},
      {rank:5,name:"Cleveland Browns",      team:"CLE",val:"52%",rec:"18-17",hot:false,note:"Run heavy"},
      {rank:6,name:"Tennessee Titans",      team:"TEN",val:"51%",rec:"17-17",hot:false,note:"Grind games"},
      {rank:7,name:"New York Jets",         team:"NYJ",val:"50%",rec:"17-18",hot:false,note:"D heavy"},
      {rank:8,name:"Carolina Panthers",     team:"CAR",val:"48%",rec:"16-18",hot:false,note:"Low offense"},
      {rank:9,name:"Chicago Bears",         team:"CHI",val:"46%",rec:"16-19",hot:false,note:"Improving O"},
      {rank:10,name:"Houston Texans",       team:"HOU",val:"44%",rec:"15-20",hot:false,note:"Young offense"},
    ],
    "Away ATS":[
      {rank:1,name:"Kansas City Chiefs",    team:"KC", val:"64%",rec:"11-6",hot:true, note:"Elite road team"},
      {rank:2,name:"San Francisco 49ers",   team:"SF", val:"61%",rec:"11-7",hot:false,note:"Shanahan road"},
      {rank:3,name:"Philadelphia Eagles",   team:"PHI",val:"58%",rec:"10-7",hot:false,note:"Strong away"},
      {rank:4,name:"Baltimore Ravens",      team:"BAL",val:"56%",rec:"10-8",hot:false,note:"Lamar travels"},
      {rank:5,name:"Detroit Lions",         team:"DET",val:"53%",rec:"9-8", hot:false,note:"Underdog value"},
      {rank:6,name:"Cincinnati Bengals",    team:"CIN",val:"50%",rec:"9-9", hot:false,note:"Even"},
      {rank:7,name:"Miami Dolphins",        team:"MIA",val:"46%",rec:"8-10",hot:false,note:"Travel fatigue"},
      {rank:8,name:"Buffalo Bills",         team:"BUF",val:"44%",rec:"7-9", hot:false,note:"Weather factor"},
      {rank:9,name:"Dallas Cowboys",        team:"DAL",val:"36%",rec:"6-11",hot:false,note:"Road struggles"},
      {rank:10,name:"New England Patriots", team:"NE", val:"31%",rec:"5-11",hot:false,note:"Rebuilding"},
    ],
    "Home ATS":[
      {rank:1,name:"Philadelphia Eagles",   team:"PHI",val:"67%",rec:"10-5",hot:true, note:"Linc dominant"},
      {rank:2,name:"Kansas City Chiefs",    team:"KC", val:"64%",rec:"9-5", hot:true, note:"Arrowhead edge"},
      {rank:3,name:"San Francisco 49ers",   team:"SF", val:"58%",rec:"9-6", hot:false,note:"Levi's"},
      {rank:4,name:"Detroit Lions",         team:"DET",val:"56%",rec:"9-7", hot:false,note:"Ford Field"},
      {rank:5,name:"Baltimore Ravens",      team:"BAL",val:"54%",rec:"8-7", hot:false,note:"M&T Bank"},
      {rank:6,name:"Cincinnati Bengals",    team:"CIN",val:"51%",rec:"8-8", hot:false,note:"Even"},
      {rank:7,name:"Houston Texans",        team:"HOU",val:"48%",rec:"7-8", hot:false,note:"NRG"},
      {rank:8,name:"Miami Dolphins",        team:"MIA",val:"44%",rec:"7-9", hot:false,note:"Heat factor"},
      {rank:9,name:"Dallas Cowboys",        team:"DAL",val:"41%",rec:"6-9", hot:false,note:"AT&T struggles"},
      {rank:10,name:"New England Patriots", team:"NE", val:"36%",rec:"5-9", hot:false,note:"Gillette fading"},
    ],
  },

};

// ── LEADERS DATA ──────────────────────────────────────────────────────────────
var LEADERS_HITTER_CATS  = ["AVG","HR","RBI","OPS","SB","H","R"];
var LEADERS_PITCHER_CATS = ["ERA","K","WHIP","Wins","Saves","IP"];
var LEADERS_TEAM_CATS    = ["Runs/G","BA","ERA","HR","SB"];

var LEADERS_BET_HITTER_CATS  = ["Hit Rate","HR Props","TB Props","H+R+RBI"];
var LEADERS_BET_PITCHER_CATS = ["K Props","Under Hits","Win Props"];
var LEADERS_BET_TEAM_CATS    = ["ATS","Over","Under","RL -1.5"];

var LEADERS = {
  hitters:{
    AVG:[
      {rank:1,name:"Luis Arraez",    team:"SD", val:".368",hot:true},
      {rank:2,name:"Freddie Freeman",team:"LAD",val:".341",hot:true},
      {rank:3,name:"Rafael Devers",  team:"BOS",val:".338",hot:false},
      {rank:4,name:"Paul Goldschmidt",team:"STL",val:".334",hot:false},
      {rank:5,name:"Juan Soto",      team:"NYY",val:".312",hot:true},
      {rank:6,name:"Corey Seager",   team:"TEX",val:".308",hot:false},
      {rank:7,name:"Yordan Alvarez", team:"HOU",val:".304",hot:false},
      {rank:8,name:"Austin Riley",   team:"ATL",val:".301",hot:false},
      {rank:9,name:"Trea Turner",    team:"PHI",val:".298",hot:false},
      {rank:10,name:"Bo Bichette",   team:"TOR",val:".294",hot:false},
    ],
    HR:[
      {rank:1,name:"Aaron Judge",    team:"NYY",val:"31",hot:true},
      {rank:2,name:"Kyle Schwarber", team:"PHI",val:"28",hot:false},
      {rank:3,name:"Yordan Alvarez", team:"HOU",val:"26",hot:true},
      {rank:4,name:"Pete Alonso",    team:"NYM",val:"24",hot:false},
      {rank:5,name:"Matt Olson",     team:"ATL",val:"23",hot:false},
      {rank:6,name:"Shohei Ohtani",  team:"LAD",val:"22",hot:true},
      {rank:7,name:"Giancarlo Stanton",team:"NYY",val:"21",hot:false},
      {rank:8,name:"Cody Bellinger", team:"CHC",val:"19",hot:false},
      {rank:9,name:"Manny Machado",  team:"SD", val:"18",hot:false},
      {rank:10,name:"Bryce Harper",  team:"PHI",val:"17",hot:false},
    ],
    RBI:[
      {rank:1,name:"Yordan Alvarez", team:"HOU",val:"84",hot:true},
      {rank:2,name:"Aaron Judge",    team:"NYY",val:"81",hot:true},
      {rank:3,name:"Matt Olson",     team:"ATL",val:"78",hot:false},
      {rank:4,name:"Pete Alonso",    team:"NYM",val:"74",hot:false},
      {rank:5,name:"Rafael Devers",  team:"BOS",val:"71",hot:false},
      {rank:6,name:"Freddie Freeman",team:"LAD",val:"68",hot:false},
      {rank:7,name:"Manny Machado",  team:"SD", val:"64",hot:false},
      {rank:8,name:"Kyle Schwarber", team:"PHI",val:"62",hot:false},
      {rank:9,name:"Austin Riley",   team:"ATL",val:"61",hot:false},
      {rank:10,name:"Bryce Harper",  team:"PHI",val:"59",hot:false},
    ],
    OPS:[
      {rank:1,name:"Aaron Judge",    team:"NYY",val:".995",hot:true},
      {rank:2,name:"Juan Soto",      team:"NYY",val:".962",hot:true},
      {rank:3,name:"Yordan Alvarez", team:"HOU",val:".948",hot:true},
      {rank:4,name:"Freddie Freeman",team:"LAD",val:".921",hot:false},
      {rank:5,name:"Shohei Ohtani",  team:"LAD",val:".918",hot:true},
      {rank:6,name:"Luis Arraez",    team:"SD", val:".901",hot:false},
      {rank:7,name:"Rafael Devers",  team:"BOS",val:".888",hot:false},
      {rank:8,name:"Kyle Schwarber", team:"PHI",val:".871",hot:false},
      {rank:9,name:"Bryce Harper",   team:"PHI",val:".864",hot:false},
      {rank:10,name:"Matt Olson",    team:"ATL",val:".858",hot:false},
    ],
    SB:[
      {rank:1,name:"Elly De La Cruz",team:"CIN",val:"38",hot:true},
      {rank:2,name:"Ronald Acuna",   team:"ATL",val:"34",hot:true},
      {rank:3,name:"Trea Turner",    team:"PHI",val:"28",hot:false},
      {rank:4,name:"Julio Rodriguez",team:"SEA",val:"26",hot:false},
      {rank:5,name:"Bobby Witt Jr.", team:"KC", val:"24",hot:true},
      {rank:6,name:"Jose Caballero", team:"TB", val:"22",hot:false},
      {rank:7,name:"Cedric Mullins", team:"BAL",val:"20",hot:false},
      {rank:8,name:"Esteury Ruiz",   team:"OAK",val:"19",hot:false},
      {rank:9,name:"DJ LeMahieu",    team:"NYY",val:"8",hot:false},
      {rank:10,name:"Ha-Seong Kim",  team:"SD", val:"18",hot:false},
    ],
    H:[
      {rank:1,name:"Luis Arraez",    team:"SD", val:"118",hot:false},
      {rank:2,name:"Freddie Freeman",team:"LAD",val:"112",hot:false},
      {rank:3,name:"Trea Turner",    team:"PHI",val:"108",hot:false},
      {rank:4,name:"Rafael Devers",  team:"BOS",val:"106",hot:false},
      {rank:5,name:"Bo Bichette",    team:"TOR",val:"104",hot:false},
      {rank:6,name:"Juan Soto",      team:"NYY",val:"102",hot:true},
      {rank:7,name:"Austin Riley",   team:"ATL",val:"99", hot:false},
      {rank:8,name:"Yordan Alvarez", team:"HOU",val:"98", hot:false},
      {rank:9,name:"Paul Goldschmidt",team:"STL",val:"96",hot:false},
      {rank:10,name:"Corey Seager",  team:"TEX",val:"94", hot:false},
    ],
    R:[
      {rank:1,name:"Aaron Judge",    team:"NYY",val:"72",hot:true},
      {rank:2,name:"Juan Soto",      team:"NYY",val:"68",hot:true},
      {rank:3,name:"Freddie Freeman",team:"LAD",val:"64",hot:false},
      {rank:4,name:"Trea Turner",    team:"PHI",val:"62",hot:false},
      {rank:5,name:"Ronald Acuna",   team:"ATL",val:"61",hot:true},
      {rank:6,name:"Yordan Alvarez", team:"HOU",val:"58",hot:false},
      {rank:7,name:"Shohei Ohtani",  team:"LAD",val:"57",hot:false},
      {rank:8,name:"Bo Bichette",    team:"TOR",val:"54",hot:false},
      {rank:9,name:"Kyle Schwarber", team:"PHI",val:"52",hot:false},
      {rank:10,name:"Bobby Witt Jr.",team:"KC", val:"51",hot:false},
    ],
  },
  pitchers:{
    ERA:[
      {rank:1,name:"Gerrit Cole",    team:"NYY",val:"2.91",hot:true},
      {rank:2,name:"Spencer Strider",team:"ATL",val:"2.98",hot:false},
      {rank:3,name:"Pablo Lopez",    team:"MIN",val:"3.12",hot:false},
      {rank:4,name:"Zack Wheeler",   team:"PHI",val:"3.18",hot:true},
      {rank:5,name:"Logan Webb",     team:"SF", val:"3.24",hot:false},
      {rank:6,name:"Tarik Skubal",   team:"DET",val:"3.31",hot:true},
      {rank:7,name:"Freddy Peralta", team:"MIL",val:"3.38",hot:false},
      {rank:8,name:"Luis Castillo",  team:"SEA",val:"3.44",hot:false},
      {rank:9,name:"Kevin Gausman",  team:"TOR",val:"3.51",hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"3.84",hot:false},
    ],
    K:[
      {rank:1,name:"Gerrit Cole",    team:"NYY",val:"148",hot:true},
      {rank:2,name:"Spencer Strider",team:"ATL",val:"141",hot:false},
      {rank:3,name:"Zack Wheeler",   team:"PHI",val:"134",hot:false},
      {rank:4,name:"Logan Gilbert",  team:"SEA",val:"128",hot:false},
      {rank:5,name:"Dylan Cease",    team:"SD", val:"124",hot:false},
      {rank:6,name:"Tarik Skubal",   team:"DET",val:"121",hot:true},
      {rank:7,name:"Freddy Peralta", team:"MIL",val:"118",hot:false},
      {rank:8,name:"Kevin Gausman",  team:"TOR",val:"114",hot:false},
      {rank:9,name:"Pablo Lopez",    team:"MIN",val:"111",hot:false},
      {rank:10,name:"Luis Castillo", team:"SEA",val:"108",hot:false},
    ],
    WHIP:[
      {rank:1,name:"Gerrit Cole",    team:"NYY",val:"0.97",hot:true},
      {rank:2,name:"Logan Webb",     team:"SF", val:"1.02",hot:false},
      {rank:3,name:"Pablo Lopez",    team:"MIN",val:"1.04",hot:false},
      {rank:4,name:"Zack Wheeler",   team:"PHI",val:"1.08",hot:false},
      {rank:5,name:"Tarik Skubal",   team:"DET",val:"1.11",hot:true},
      {rank:6,name:"Spencer Strider",team:"ATL",val:"1.14",hot:false},
      {rank:7,name:"Luis Castillo",  team:"SEA",val:"1.18",hot:false},
      {rank:8,name:"Freddy Peralta", team:"MIL",val:"1.21",hot:false},
      {rank:9,name:"Kevin Gausman",  team:"TOR",val:"1.24",hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"1.28",hot:false},
    ],
    Wins:[
      {rank:1,name:"Zack Wheeler",   team:"PHI",val:"13",hot:false},
      {rank:2,name:"Gerrit Cole",    team:"NYY",val:"12",hot:true},
      {rank:3,name:"Logan Webb",     team:"SF", val:"11",hot:false},
      {rank:4,name:"Spencer Strider",team:"ATL",val:"11",hot:false},
      {rank:5,name:"Pablo Lopez",    team:"MIN",val:"10",hot:false},
      {rank:6,name:"Tarik Skubal",   team:"DET",val:"10",hot:true},
      {rank:7,name:"Luis Castillo",  team:"SEA",val:"10",hot:false},
      {rank:8,name:"Freddy Peralta", team:"MIL",val:"9", hot:false},
      {rank:9,name:"Kevin Gausman",  team:"TOR",val:"9", hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"8", hot:false},
    ],
    Saves:[
      {rank:1,name:"Clay Holmes",    team:"NYY",val:"24",hot:true},
      {rank:2,name:"Ryan Helsley",   team:"STL",val:"22",hot:false},
      {rank:3,name:"Alexis Diaz",    team:"CIN",val:"20",hot:false},
      {rank:4,name:"Camilo Doval",   team:"SF", val:"19",hot:false},
      {rank:5,name:"Jordan Romano",  team:"TOR",val:"18",hot:false},
      {rank:6,name:"Felix Bautista", team:"BAL",val:"17",hot:true},
      {rank:7,name:"Kenley Jansen",  team:"BOS",val:"16",hot:false},
      {rank:8,name:"Devin Williams", team:"MIL",val:"16",hot:false},
      {rank:9,name:"Emmanuel Clase", team:"CLE",val:"15",hot:false},
      {rank:10,name:"Josh Hader",    team:"HOU",val:"14",hot:false},
    ],
    IP:[
      {rank:1,name:"Zack Wheeler",   team:"PHI",val:"124.2",hot:false},
      {rank:2,name:"Gerrit Cole",    team:"NYY",val:"122.1",hot:true},
      {rank:3,name:"Logan Webb",     team:"SF", val:"119.0",hot:false},
      {rank:4,name:"Pablo Lopez",    team:"MIN",val:"116.2",hot:false},
      {rank:5,name:"Spencer Strider",team:"ATL",val:"114.1",hot:false},
      {rank:6,name:"Luis Castillo",  team:"SEA",val:"112.0",hot:false},
      {rank:7,name:"Kevin Gausman",  team:"TOR",val:"110.2",hot:false},
      {rank:8,name:"Tarik Skubal",   team:"DET",val:"108.1",hot:true},
      {rank:9,name:"Freddy Peralta", team:"MIL",val:"106.0",hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"104.2",hot:false},
    ],
  },
  teams:{
    "Runs/G":[
      {rank:1,name:"Los Angeles Dodgers",team:"LAD",val:"5.28",hot:true},
      {rank:2,name:"New York Yankees",   team:"NYY",val:"5.14",hot:true},
      {rank:3,name:"Philadelphia Phillies",team:"PHI",val:"5.02",hot:false},
      {rank:4,name:"Houston Astros",     team:"HOU",val:"4.88",hot:false},
      {rank:5,name:"Atlanta Braves",     team:"ATL",val:"4.74",hot:false},
      {rank:6,name:"Minnesota Twins",    team:"MIN",val:"4.68",hot:false},
      {rank:7,name:"Seattle Mariners",   team:"SEA",val:"4.41",hot:true},
      {rank:8,name:"Boston Red Sox",     team:"BOS",val:"4.38",hot:false},
      {rank:9,name:"San Diego Padres",   team:"SD", val:"4.31",hot:false},
      {rank:10,name:"Toronto Blue Jays", team:"TOR",val:"4.24",hot:false},
    ],
    BA:[
      {rank:1,name:"Los Angeles Dodgers",team:"LAD",val:".274",hot:true},
      {rank:2,name:"Philadelphia Phillies",team:"PHI",val:".268",hot:false},
      {rank:3,name:"New York Yankees",   team:"NYY",val:".264",hot:false},
      {rank:4,name:"Atlanta Braves",     team:"ATL",val:".261",hot:false},
      {rank:5,name:"Houston Astros",     team:"HOU",val:".258",hot:false},
      {rank:6,name:"Minnesota Twins",    team:"MIN",val:".254",hot:false},
      {rank:7,name:"Boston Red Sox",     team:"BOS",val:".251",hot:false},
      {rank:8,name:"San Diego Padres",   team:"SD", val:".248",hot:false},
      {rank:9,name:"Toronto Blue Jays",  team:"TOR",val:".244",hot:false},
      {rank:10,name:"Seattle Mariners",  team:"SEA",val:".241",hot:false},
    ],
    ERA:[
      {rank:1,name:"Los Angeles Dodgers",team:"LAD",val:"2.98",hot:true},
      {rank:2,name:"Milwaukee Brewers",  team:"MIL",val:"3.14",hot:true},
      {rank:3,name:"New York Yankees",   team:"NYY",val:"3.21",hot:false},
      {rank:4,name:"Seattle Mariners",   team:"SEA",val:"3.28",hot:false},
      {rank:5,name:"Atlanta Braves",     team:"ATL",val:"3.34",hot:false},
      {rank:6,name:"Philadelphia Phillies",team:"PHI",val:"3.41",hot:false},
      {rank:7,name:"Houston Astros",     team:"HOU",val:"3.48",hot:false},
      {rank:8,name:"Minnesota Twins",    team:"MIN",val:"3.54",hot:false},
      {rank:9,name:"Cleveland Guardians",team:"CLE",val:"3.61",hot:false},
      {rank:10,name:"San Diego Padres",  team:"SD", val:"3.68",hot:false},
    ],
    HR:[
      {rank:1,name:"New York Yankees",   team:"NYY",val:"114",hot:true},
      {rank:2,name:"Philadelphia Phillies",team:"PHI",val:"108",hot:false},
      {rank:3,name:"Los Angeles Dodgers",team:"LAD",val:"104",hot:false},
      {rank:4,name:"Houston Astros",     team:"HOU",val:"98", hot:false},
      {rank:5,name:"Atlanta Braves",     team:"ATL",val:"94", hot:false},
      {rank:6,name:"Minnesota Twins",    team:"MIN",val:"91", hot:false},
      {rank:7,name:"New York Mets",      team:"NYM",val:"88", hot:false},
      {rank:8,name:"Boston Red Sox",     team:"BOS",val:"84", hot:false},
      {rank:9,name:"San Diego Padres",   team:"SD", val:"81", hot:false},
      {rank:10,name:"Toronto Blue Jays", team:"TOR",val:"78", hot:false},
    ],
    SB:[
      {rank:1,name:"Cincinnati Reds",    team:"CIN",val:"88",hot:false},
      {rank:2,name:"Atlanta Braves",     team:"ATL",val:"84",hot:true},
      {rank:3,name:"Kansas City Royals", team:"KC", val:"78",hot:false},
      {rank:4,name:"Philadelphia Phillies",team:"PHI",val:"74",hot:false},
      {rank:5,name:"Seattle Mariners",   team:"SEA",val:"68",hot:true},
      {rank:6,name:"Tampa Bay Rays",     team:"TB", val:"64",hot:false},
      {rank:7,name:"Los Angeles Dodgers",team:"LAD",val:"62",hot:false},
      {rank:8,name:"Texas Rangers",      team:"TEX",val:"58",hot:false},
      {rank:9,name:"Pittsburgh Pirates", team:"PIT",val:"54",hot:false},
      {rank:10,name:"Oakland Athletics", team:"OAK",val:"51",hot:false},
    ],
  },
  bet_hitters:{
    "Hit Rate":[
      {rank:1,name:"Juan Soto",      team:"NYY",val:"79%",rec:"22-6", hot:true},
      {rank:2,name:"Freddie Freeman",team:"LAD",val:"76%",rec:"19-6", hot:false},
      {rank:3,name:"Luis Arraez",    team:"SD", val:"74%",rec:"20-7", hot:false},
      {rank:4,name:"Aaron Judge",    team:"NYY",val:"72%",rec:"21-8", hot:true},
      {rank:5,name:"Rafael Devers",  team:"BOS",val:"68%",rec:"19-9", hot:false},
      {rank:6,name:"Masataka Yoshida",team:"BOS",val:"71%",rec:"20-8",hot:true},
      {rank:7,name:"Yordan Alvarez", team:"HOU",val:"68%",rec:"18-8", hot:false},
      {rank:8,name:"Trea Turner",    team:"PHI",val:"66%",rec:"17-9", hot:false},
      {rank:9,name:"Corey Seager",   team:"TEX",val:"64%",rec:"16-9", hot:false},
      {rank:10,name:"Bo Bichette",   team:"TOR",val:"62%",rec:"16-10",hot:false},
    ],
    "HR Props":[
      {rank:1,name:"Aaron Judge",    team:"NYY",val:"43%",rec:"12-16",hot:true},
      {rank:2,name:"Shohei Ohtani",  team:"LAD",val:"41%",rec:"11-16",hot:true},
      {rank:3,name:"Yordan Alvarez", team:"HOU",val:"38%",rec:"10-16",hot:false},
      {rank:4,name:"Kyle Schwarber", team:"PHI",val:"36%",rec:"9-16", hot:false},
      {rank:5,name:"Pete Alonso",    team:"NYM",val:"34%",rec:"9-17", hot:false},
      {rank:6,name:"Matt Olson",     team:"ATL",val:"32%",rec:"8-17", hot:false},
      {rank:7,name:"Giancarlo Stanton",team:"NYY",val:"31%",rec:"8-18",hot:false},
      {rank:8,name:"Bryce Harper",   team:"PHI",val:"29%",rec:"7-17", hot:false},
      {rank:9,name:"Manny Machado",  team:"SD", val:"28%",rec:"7-18", hot:false},
      {rank:10,name:"Rafael Devers", team:"BOS",val:"27%",rec:"7-19", hot:false},
    ],
    "TB Props":[
      {rank:1,name:"Aaron Judge",    team:"NYY",val:"68%",rec:"19-9", hot:true},
      {rank:2,name:"Juan Soto",      team:"NYY",val:"66%",rec:"18-9", hot:true},
      {rank:3,name:"Freddie Freeman",team:"LAD",val:"64%",rec:"17-9", hot:false},
      {rank:4,name:"Yordan Alvarez", team:"HOU",val:"62%",rec:"16-10",hot:false},
      {rank:5,name:"Rafael Devers",  team:"BOS",val:"61%",rec:"16-10",hot:false},
      {rank:6,name:"Luis Arraez",    team:"SD", val:"59%",rec:"15-10",hot:false},
      {rank:7,name:"Shohei Ohtani",  team:"LAD",val:"58%",rec:"15-11",hot:false},
      {rank:8,name:"Trea Turner",    team:"PHI",val:"56%",rec:"14-11",hot:false},
      {rank:9,name:"Austin Riley",   team:"ATL",val:"54%",rec:"14-12",hot:false},
      {rank:10,name:"Corey Seager",  team:"TEX",val:"52%",rec:"13-12",hot:false},
    ],
    "H+R+RBI":[
      {rank:1,name:"Aaron Judge",    team:"NYY",val:"74%",rec:"21-7", hot:true},
      {rank:2,name:"Yordan Alvarez", team:"HOU",val:"71%",rec:"19-8", hot:true},
      {rank:3,name:"Juan Soto",      team:"NYY",val:"68%",rec:"18-9", hot:true},
      {rank:4,name:"Freddie Freeman",team:"LAD",val:"66%",rec:"17-9", hot:false},
      {rank:5,name:"Rafael Devers",  team:"BOS",val:"64%",rec:"17-10",hot:false},
      {rank:6,name:"Matt Olson",     team:"ATL",val:"61%",rec:"16-10",hot:false},
      {rank:7,name:"Bryce Harper",   team:"PHI",val:"59%",rec:"15-11",hot:false},
      {rank:8,name:"Trea Turner",    team:"PHI",val:"57%",rec:"14-11",hot:false},
      {rank:9,name:"Kyle Schwarber", team:"PHI",val:"55%",rec:"14-12",hot:false},
      {rank:10,name:"Manny Machado", team:"SD", val:"53%",rec:"13-12",hot:false},
    ],
  },
  bet_pitchers:{
    "K Props":[
      {rank:1,name:"Gerrit Cole",    team:"NYY",val:"76%",rec:"19-6", hot:true},
      {rank:2,name:"Spencer Strider",team:"ATL",val:"72%",rec:"18-7", hot:false},
      {rank:3,name:"Zack Wheeler",   team:"PHI",val:"68%",rec:"17-8", hot:false},
      {rank:4,name:"Tarik Skubal",   team:"DET",val:"66%",rec:"17-9", hot:true},
      {rank:5,name:"Dylan Cease",    team:"SD", val:"64%",rec:"16-9", hot:false},
      {rank:6,name:"Logan Gilbert",  team:"SEA",val:"62%",rec:"16-10",hot:false},
      {rank:7,name:"Freddy Peralta", team:"MIL",val:"61%",rec:"15-10",hot:false},
      {rank:8,name:"Luis Castillo",  team:"SEA",val:"59%",rec:"15-11",hot:false},
      {rank:9,name:"Pablo Lopez",    team:"MIN",val:"57%",rec:"14-11",hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"54%",rec:"13-11",hot:false},
    ],
    "Under Hits":[
      {rank:1,name:"Gerrit Cole",    team:"NYY",val:"78%",rec:"21-6", hot:true},
      {rank:2,name:"Logan Webb",     team:"SF", val:"74%",rec:"19-7", hot:false},
      {rank:3,name:"Pablo Lopez",    team:"MIN",val:"71%",rec:"18-7", hot:false},
      {rank:4,name:"Tarik Skubal",   team:"DET",val:"68%",rec:"17-8", hot:true},
      {rank:5,name:"Spencer Strider",team:"ATL",val:"66%",rec:"16-8", hot:false},
      {rank:6,name:"Zack Wheeler",   team:"PHI",val:"64%",rec:"16-9", hot:false},
      {rank:7,name:"Luis Castillo",  team:"SEA",val:"62%",rec:"15-9", hot:false},
      {rank:8,name:"Freddy Peralta", team:"MIL",val:"60%",rec:"15-10",hot:false},
      {rank:9,name:"Kevin Gausman",  team:"TOR",val:"58%",rec:"14-10",hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"55%",rec:"13-11",hot:false},
    ],
    "Win Props":[
      {rank:1,name:"Zack Wheeler",   team:"PHI",val:"68%",rec:"17-8", hot:false},
      {rank:2,name:"Gerrit Cole",    team:"NYY",val:"66%",rec:"17-9", hot:true},
      {rank:3,name:"Logan Webb",     team:"SF", val:"64%",rec:"16-9", hot:false},
      {rank:4,name:"Spencer Strider",team:"ATL",val:"62%",rec:"16-10",hot:false},
      {rank:5,name:"Pablo Lopez",    team:"MIN",val:"60%",rec:"15-10",hot:false},
      {rank:6,name:"Luis Castillo",  team:"SEA",val:"58%",rec:"14-10",hot:false},
      {rank:7,name:"Tarik Skubal",   team:"DET",val:"57%",rec:"14-11",hot:true},
      {rank:8,name:"Freddy Peralta", team:"MIL",val:"55%",rec:"14-12",hot:false},
      {rank:9,name:"Kevin Gausman",  team:"TOR",val:"53%",rec:"13-12",hot:false},
      {rank:10,name:"Brayan Bello",  team:"BOS",val:"51%",rec:"13-13",hot:false},
    ],
  },
  bet_teams:{
    ATS:[
      {rank:1,name:"Milwaukee Brewers",  team:"MIL",val:"59%",rec:"47-33",hot:true},
      {rank:2,name:"Los Angeles Dodgers",team:"LAD",val:"60%",rec:"48-32",hot:true},
      {rank:3,name:"Seattle Mariners",   team:"SEA",val:"58%",rec:"46-34",hot:true},
      {rank:4,name:"Philadelphia Phillies",team:"PHI",val:"58%",rec:"46-34",hot:false},
      {rank:5,name:"Houston Astros",     team:"HOU",val:"56%",rec:"45-35",hot:false},
      {rank:6,name:"Minnesota Twins",    team:"MIN",val:"55%",rec:"44-36",hot:false},
      {rank:7,name:"Atlanta Braves",     team:"ATL",val:"55%",rec:"44-36",hot:false},
      {rank:8,name:"Kansas City Royals", team:"KC", val:"50%",rec:"40-40",hot:false},
      {rank:9,name:"Chicago Cubs",       team:"CHC",val:"53%",rec:"42-38",hot:false},
      {rank:10,name:"Arizona D-backs",   team:"ARI",val:"54%",rec:"43-37",hot:false},
    ],
    Over:[
      {rank:1,name:"Colorado Rockies",   team:"COL",val:"58%",rec:"46-33",hot:false},
      {rank:2,name:"Baltimore Orioles",  team:"BAL",val:"56%",rec:"44-35",hot:false},
      {rank:3,name:"Los Angeles Dodgers",team:"LAD",val:"56%",rec:"44-35",hot:true},
      {rank:4,name:"New York Yankees",   team:"NYY",val:"51%",rec:"38-40",hot:false},
      {rank:5,name:"Texas Rangers",      team:"TEX",val:"53%",rec:"42-37",hot:false},
      {rank:6,name:"Philadelphia Phillies",team:"PHI",val:"53%",rec:"42-37",hot:false},
      {rank:7,name:"Houston Astros",     team:"HOU",val:"52%",rec:"41-38",hot:false},
      {rank:8,name:"Boston Red Sox",     team:"BOS",val:"52%",rec:"41-38",hot:false},
      {rank:9,name:"New York Mets",      team:"NYM",val:"52%",rec:"41-38",hot:false},
      {rank:10,name:"Toronto Blue Jays", team:"TOR",val:"51%",rec:"40-39",hot:false},
    ],
    Under:[
      {rank:1,name:"Milwaukee Brewers",  team:"MIL",val:"53%",rec:"42-37",hot:true},
      {rank:2,name:"Seattle Mariners",   team:"SEA",val:"54%",rec:"43-36",hot:true},
      {rank:3,name:"Minnesota Twins",    team:"MIN",val:"51%",rec:"39-40",hot:false},
      {rank:4,name:"Los Angeles Dodgers",team:"LAD",val:"44%",rec:"35-44",hot:false},
      {rank:5,name:"Cleveland Guardians",team:"CLE",val:"52%",rec:"41-38",hot:false},
      {rank:6,name:"Tampa Bay Rays",     team:"TB", val:"54%",rec:"43-36",hot:false},
      {rank:7,name:"Chicago White Sox",  team:"CWS",val:"56%",rec:"45-34",hot:false},
      {rank:8,name:"Oakland Athletics",  team:"OAK",val:"55%",rec:"44-35",hot:false},
      {rank:9,name:"San Francisco Giants",team:"SF",val:"52%",rec:"41-38",hot:false},
      {rank:10,name:"Pittsburgh Pirates",team:"PIT",val:"54%",rec:"43-36",hot:false},
    ],
    "RL -1.5":[
      {rank:1,name:"Los Angeles Dodgers",team:"LAD",val:"51%",rec:"40-39",hot:true},
      {rank:2,name:"Houston Astros",     team:"HOU",val:"46%",rec:"36-43",hot:false},
      {rank:3,name:"New York Yankees",   team:"NYY",val:"44%",rec:"28-50",hot:false},
      {rank:4,name:"Philadelphia Phillies",team:"PHI",val:"46%",rec:"36-43",hot:false},
      {rank:5,name:"Atlanta Braves",     team:"ATL",val:"43%",rec:"34-45",hot:false},
      {rank:6,name:"Milwaukee Brewers",  team:"MIL",val:"44%",rec:"35-44",hot:false},
      {rank:7,name:"Minnesota Twins",    team:"MIN",val:"43%",rec:"34-45",hot:false},
      {rank:8,name:"Seattle Mariners",   team:"SEA",val:"43%",rec:"34-45",hot:false},
      {rank:9,name:"San Diego Padres",   team:"SD", val:"43%",rec:"34-45",hot:false},
      {rank:10,name:"Boston Red Sox",    team:"BOS",val:"41%",rec:"32-47",hot:false},
    ],
  },
};


// ── LEADERS TAB ───────────────────────────────────────────────────────────────
function LeadersTab(props) {
  var sport = props.sport || "mlb";
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var subArr = useState(sport==="nfl"?"Teams":"Hitters");
  var sub = subArr[0]; var setSub = subArr[1];
  var catArr = useState(sport==="nfl"?"Points/G":"AVG");
  var cat = catArr[0]; var setCat = catArr[1];
  var teamFilterArr = useState("All");
  var teamFilter = teamFilterArr[0]; var setTeamFilter = teamFilterArr[1];
  var showFilterArr = useState(false);
  var showFilter = showFilterArr[0]; var setShowFilter = showFilterArr[1];

  var nflSubs = ["Teams","QB","RB","WR","TE","DEF"];
  var mlbSubs = ["Hitters","Pitchers","Teams"];
  var subs = sport==="nfl" ? nflSubs : mlbSubs;

  var cats = sport==="nfl"
    ? (view==="Game Stats"
        ? (sub==="QB"?NFL_LEADERS_QB_CATS:sub==="RB"?NFL_LEADERS_RB_CATS:
           sub==="WR"?NFL_LEADERS_WR_CATS:sub==="TE"?NFL_LEADERS_TE_CATS:sub==="Teams"?NFL_LEADERS_NFL_TEAM_CATS:NFL_LEADERS_DEF_CATS)
        : (sub==="QB"?NFL_LEADERS_BET_QB_CATS:sub==="RB"?NFL_LEADERS_BET_RB_CATS:
           sub==="WR"?NFL_LEADERS_BET_WR_CATS:sub==="TE"?NFL_LEADERS_BET_TE_CATS:sub==="Teams"?NFL_LEADERS_BET_NFL_TEAM_CATS:NFL_LEADERS_BET_DEF_CATS))
    : (view==="Game Stats"
        ? (sub==="Hitters"?LEADERS_HITTER_CATS:sub==="Pitchers"?LEADERS_PITCHER_CATS:LEADERS_TEAM_CATS)
        : (sub==="Hitters"?LEADERS_BET_HITTER_CATS:sub==="Pitchers"?LEADERS_BET_PITCHER_CATS:LEADERS_BET_TEAM_CATS));

  var dataKey = sport==="nfl"
    ? (view==="Game Stats"
        ? (sub==="QB"?"QB":sub==="RB"?"RB":sub==="WR"?"WR":sub==="TE"?"TE":sub==="Teams"?"NFL_Teams":"DEF")
        : (sub==="QB"?"bet_QB":sub==="RB"?"bet_RB":sub==="WR"?"bet_WR":sub==="TE"?"bet_TE":sub==="Teams"?"bet_NFL_Teams":"bet_DEF"))
    : (view==="Game Stats"
        ? (sub==="Hitters"?"hitters":sub==="Pitchers"?"pitchers":"teams")
        : (sub==="Hitters"?"bet_hitters":sub==="Pitchers"?"bet_pitchers":"bet_teams"));

  var leaderData = sport==="nfl" ? NFL_LEADERS : LEADERS;
  var rows = (leaderData[dataKey]||{})[cat] || [];
  var filtered = teamFilter==="All" ? rows :
    rows.filter(function(r){ return r.team===teamFilter; });

  var isBetting = view==="Betting Stats";
  var valColor = function(r) {
    if(!isBetting) return TEXT;
    var n = parseFloat(r.val);
    return n>=65?POS_C:n<=45?NEG_C:TEXT2;
  };

  if(sport==="nba" || sport==="nhl") {
    return (
      <div style={{paddingBottom:80}}>
        <div style={{padding:"60px 24px",textAlign:"center",animation:"fadeUp .2s ease"}}>
          <div style={{fontSize:48,marginBottom:16}}>{sport==="nba"?"🏀":"🏒"}</div>
          <div style={{fontSize:18,fontWeight:900,color:TEXT,marginBottom:8}}>
            {sport==="nba"?"NBA":"NHL"} Coming Soon
          </div>
          <div style={{fontSize:12,color:MUTED,lineHeight:1.7,
            maxWidth:280,margin:"8px auto 24px"}}>
            {sport==="nba"?"NBA":"NHL"} coverage is in development.
            Check back soon for full standings, leaders, and analysis.
          </div>
          <div style={{display:"inline-block",padding:"8px 20px",borderRadius:20,
            background:ACCENT+"22",border:"1px solid "+ACCENT+"44",
            fontSize:11,fontWeight:700,color:ACCENT}}>
            In Development
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:80,animation:"fadeUp .2s ease"}}>
      <div style={{padding:"14px 14px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12,
          background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
          {["Game Stats","Betting Stats"].map(function(v) {
            var isActive = view===v;
            return (
              <button key={v} onClick={function(){setView(v);setCat(cats[0]);}}
                style={{padding:"8px",borderRadius:9,fontSize:12,
                  fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                  background:isActive?ACCENT:"transparent",
                  color:isActive?"#fff":MUTED}}>
                {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
              </button>
            );
          })}
        </div>

        <div style={{display:"flex",gap:6,marginBottom:12,
          overflowX:"auto",paddingBottom:2}}>
          {subs.map(function(s) {
            var isActive = sub===s;
            var icon = sport==="nfl"
              ? (s==="QB"?"🏈":s==="RB"?"🏃":s==="WR"?"🎯":s==="TE"?"🙌":s==="Teams"?"🏟":"🛡")
              : (s==="Hitters"?"🔥":s==="Pitchers"?"⚾":"🏟");
            return (
              <button key={s} onClick={function(){setSub(s);setCat(cats[0]);}}
                style={{padding:"6px 14px",borderRadius:20,fontSize:11,
                  fontWeight:isActive?700:500,cursor:"pointer",flexShrink:0,
                  border:"1px solid "+(isActive?ACCENT:BORDER),
                  background:isActive?ACCENT:"transparent",
                  color:isActive?"#fff":MUTED,
                  display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:12}}>{icon}</span>
                {s}
              </button>
            );
          })}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{flex:1,display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
            {cats.map(function(c) {
              var isActive = cat===c;
              return (
                <button key={c} onClick={function(){setCat(c);}}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,
                    cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                    background:isActive?ACCENT:"transparent",
                    border:"1px solid "+(isActive?ACCENT:BORDER),
                    color:isActive?"#fff":MUTED}}>
                  {c}
                </button>
              );
            })}
          </div>
          <button onClick={function(){setShowFilter(!showFilter);}}
            style={{flexShrink:0,padding:"5px 10px",borderRadius:14,fontSize:11,
              fontWeight:600,cursor:"pointer",
              background:teamFilter!=="All"?ACCENT+"22":"transparent",
              border:"1px solid "+(teamFilter!=="All"?ACCENT:BORDER),
              color:teamFilter!=="All"?ACCENT:MUTED}}>
            {teamFilter!=="All"?teamFilter:"⚙ Filter"}
          </button>
        </div>

        {showFilter && (
          <div style={{background:CARD,border:"1px solid "+BORDER,borderRadius:12,
            padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:8}}>FILTER BY TEAM</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {["All"].concat(Object.keys(TEAM_C)).map(function(t) {
                var isActive = teamFilter===t;
                return (
                  <button key={t} onClick={function(){setTeamFilter(t);setShowFilter(false);}}
                    style={{padding:"4px 8px",borderRadius:10,fontSize:10,fontWeight:600,
                      cursor:"pointer",
                      background:isActive?ACCENT+"22":"transparent",
                      border:"1px solid "+(isActive?ACCENT:BORDER),
                      color:isActive?ACCENT:TEXT2}}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{padding:"0 14px"}}>
        <div style={{background:CARD,border:"1px solid "+BORDER,
          borderRadius:14,overflow:"hidden"}}>
          <div style={{display:"grid",
            gridTemplateColumns:isBetting?"28px 2fr 44px 56px 56px":"28px 2fr 44px 56px",
            padding:"7px 12px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
            {(isBetting
              ?["#","PLAYER / TEAM","TEAM","Record","Hit%"]
              :["#","PLAYER / TEAM","TEAM",sport==="nfl"?"Note":"Value"]
            ).map(function(h) {
              return (
                <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                  textAlign:h==="#"||h==="PLAYER / TEAM"?"left":"center"}}>{h}</div>
              );
            })}
          </div>

          {filtered.length===0 && (
            <div style={{padding:"24px",textAlign:"center",color:MUTED,fontSize:11}}>
              No results for {teamFilter}. Try a different team or category.
            </div>
          )}

          {filtered.map(function(r, i) {
            var tc = (sport==="nfl"?NFL_TEAM_C:TEAM_C)[r.team] || ACCENT;
            var vc = isBetting
              ? (parseFloat(r.val)>=65?POS_C:parseFloat(r.val)<=45?NEG_C:TEXT2)
              : TEXT;
            return (
              <div key={i} style={{display:"grid",
                gridTemplateColumns:isBetting?"28px 2fr 44px 56px 56px":"28px 2fr 44px 56px",
                padding:"10px 12px",alignItems:"center",
                borderBottom:i<filtered.length-1?"1px solid "+BORDER:"none",
                background:i===0?"rgba(77,159,255,.05)":"transparent"}}>
                <div style={{fontSize:12,fontWeight:800,
                  color:i===0?ACCENT:i===1?TEXT2:MUTED}}>{r.rank}</div>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  {r.hot && <span style={{fontSize:9}}>🔥</span>}
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:TEXT}}>{r.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 5px",
                    borderRadius:6,background:tc+"22",color:tc}}>{r.team}</span>
                </div>
                {isBetting && (
                  <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{r.rec}</div>
                )}
                <div style={{textAlign:"center",fontSize:isBetting?14:
                  (sport==="nfl"?10:14),fontWeight:800,
                  color:isBetting?vc:TEXT,
                  fontFamily:"'IBM Plex Mono',monospace",
                  lineHeight:1.3}}>
                  {r.val}
                  {sport==="nfl" && !isBetting && r.note && (
                    <div style={{fontSize:8,color:MUTED,fontWeight:400,
                      marginTop:2}}>{r.note}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ── NFL STANDINGS DATA ────────────────────────────────────────────────────────
var NFL_CONF_DIVISIONS = ["AFC East","AFC North","AFC South","AFC West","NFC East","NFC North","NFC South","NFC West"];
var NFL_STANDINGS = {
  "AFC East":[
    {a:"BUF",w:11,l:6,pct:".647",gb:"—", stk:"W2",l10:"7-3",pf:312,pa:248,div:"3-3",ats:"20-17",ats_p:54,ou:"18-18",ou_p:50,rl_m:"14-23",rl_p:"23-14",hot:true},
    {a:"MIA",w:9, l:8,pct:".529",gb:"2", stk:"L1",l10:"5-5",pf:284,pa:264,div:"2-4",ats:"18-19",ats_p:49,ou:"21-16",ou_p:57,rl_m:"12-25",rl_p:"25-12",hot:false},
    {a:"NYJ",w:7, l:10,pct:".412",gb:"4",stk:"L3",l10:"4-6",pf:224,pa:268,div:"2-4",ats:"16-21",ats_p:43,ou:"14-23",ou_p:38,rl_m:"9-28", rl_p:"28-9", hot:false},
    {a:"NE", w:4, l:13,pct:".235",gb:"7",stk:"L2",l10:"3-7",pf:188,pa:312,div:"1-5",ats:"13-24",ats_p:35,ou:"12-25",ou_p:32,rl_m:"6-31", rl_p:"31-6", hot:false},
  ],
  "AFC North":[
    {a:"BAL",w:13,l:4,pct:".765",gb:"—", stk:"W4",l10:"8-2",pf:358,pa:224,div:"4-2",ats:"22-15",ats_p:59,ou:"19-18",ou_p:51,rl_m:"18-19",rl_p:"19-18",hot:true},
    {a:"CLE",w:11,l:6,pct:".647",gb:"2", stk:"W1",l10:"6-4",pf:288,pa:248,div:"4-2",ats:"20-17",ats_p:54,ou:"14-23",ou_p:38,rl_m:"14-23",rl_p:"23-14",hot:false},
    {a:"PIT",w:10,l:7,pct:".588",gb:"3", stk:"L1",l10:"5-5",pf:264,pa:254,div:"3-3",ats:"19-18",ats_p:51,ou:"15-22",ou_p:41,rl_m:"12-25",rl_p:"25-12",hot:false},
    {a:"CIN",w:9, l:8,pct:".529",gb:"4", stk:"W2",l10:"5-5",pf:278,pa:261,div:"2-4",ats:"18-19",ats_p:49,ou:"20-17",ou_p:54,rl_m:"13-24",rl_p:"24-13",hot:false},
  ],
  "AFC South":[
    {a:"HOU",w:10,l:7,pct:".588",gb:"—", stk:"W3",l10:"6-4",pf:298,pa:271,div:"3-3",ats:"19-18",ats_p:51,ou:"18-19",ou_p:49,rl_m:"13-24",rl_p:"24-13",hot:true},
    {a:"IND",w:9, l:8,pct:".529",gb:"1", stk:"L2",l10:"5-5",pf:264,pa:258,div:"3-3",ats:"17-20",ats_p:46,ou:"16-21",ou_p:43,rl_m:"11-26",rl_p:"26-11",hot:false},
    {a:"TEN",w:6, l:11,pct:".353",gb:"4",stk:"L4",l10:"3-7",pf:228,pa:294,div:"2-4",ats:"15-22",ats_p:41,ou:"15-22",ou_p:41,rl_m:"9-28", rl_p:"28-9", hot:false},
    {a:"JAX",w:9, l:8,pct:".529",gb:"1", stk:"W1",l10:"5-5",pf:271,pa:268,div:"2-4",ats:"16-21",ats_p:43,ou:"17-20",ou_p:46,rl_m:"11-26",rl_p:"26-11",hot:false},
  ],
  "AFC West":[
    {a:"KC", w:11,l:6,pct:".647",gb:"—", stk:"W3",l10:"7-3",pf:334,pa:238,div:"4-2",ats:"21-16",ats_p:57,ou:"20-17",ou_p:54,rl_m:"16-21",rl_p:"21-16",hot:true},
    {a:"LV", w:8, l:9,pct:".471",gb:"3", stk:"L2",l10:"5-5",pf:244,pa:268,div:"2-4",ats:"16-21",ats_p:43,ou:"17-20",ou_p:46,rl_m:"11-26",rl_p:"26-11",hot:false},
    {a:"DEN",w:8, l:9,pct:".471",gb:"3", stk:"W1",l10:"5-5",pf:238,pa:254,div:"2-4",ats:"15-22",ats_p:41,ou:"14-23",ou_p:38,rl_m:"10-27",rl_p:"27-10",hot:false},
    {a:"LAC",w:5, l:12,pct:".294",gb:"6",stk:"L3",l10:"2-8",pf:208,pa:304,div:"1-5",ats:"13-24",ats_p:35,ou:"16-21",ou_p:43,rl_m:"7-30", rl_p:"30-7", hot:false},
  ],
  "NFC East":[
    {a:"PHI",w:11,l:6,pct:".647",gb:"—", stk:"W4",l10:"8-2",pf:338,pa:248,div:"4-2",ats:"22-15",ats_p:59,ou:"19-18",ou_p:51,rl_m:"16-21",rl_p:"21-16",hot:true},
    {a:"DAL",w:10,l:7,pct:".588",gb:"1", stk:"L2",l10:"5-5",pf:298,pa:271,div:"3-3",ats:"14-23",ats_p:38,ou:"18-19",ou_p:49,rl_m:"12-25",rl_p:"25-12",hot:false},
    {a:"NYG",w:6, l:11,pct:".353",gb:"5",stk:"L3",l10:"3-7",pf:218,pa:294,div:"2-4",ats:"15-22",ats_p:41,ou:"15-22",ou_p:41,rl_m:"9-28", rl_p:"28-9", hot:false},
    {a:"WAS",w:4, l:13,pct:".235",gb:"7",stk:"L5",l10:"2-8",pf:194,pa:328,div:"1-5",ats:"12-25",ats_p:32,ou:"14-23",ou_p:38,rl_m:"6-31", rl_p:"31-6", hot:false},
  ],
  "NFC North":[
    {a:"DET",w:12,l:5,pct:".706",gb:"—", stk:"W5",l10:"8-2",pf:354,pa:258,div:"4-2",ats:"21-16",ats_p:57,ou:"20-17",ou_p:54,rl_m:"16-21",rl_p:"21-16",hot:true},
    {a:"GB", w:9, l:8,pct:".529",gb:"3", stk:"W1",l10:"5-5",pf:264,pa:248,div:"3-3",ats:"18-19",ats_p:49,ou:"15-22",ou_p:41,rl_m:"12-25",rl_p:"25-12",hot:false},
    {a:"MIN",w:7, l:10,pct:".412",gb:"5",stk:"L2",l10:"4-6",pf:241,pa:268,div:"2-4",ats:"16-21",ats_p:43,ou:"16-21",ou_p:43,rl_m:"10-27",rl_p:"27-10",hot:false},
    {a:"CHI",w:5, l:12,pct:".294",gb:"7",stk:"L4",l10:"3-7",pf:208,pa:308,div:"1-5",ats:"14-23",ats_p:38,ou:"13-24",ou_p:35,rl_m:"7-30", rl_p:"30-7", hot:false},
  ],
  "NFC South":[
    {a:"TB", w:9, l:8,pct:".529",gb:"—", stk:"W2",l10:"6-4",pf:274,pa:258,div:"4-2",ats:"18-19",ats_p:49,ou:"16-21",ou_p:43,rl_m:"12-25",rl_p:"25-12",hot:true},
    {a:"NO", w:9, l:8,pct:".529",gb:"—", stk:"L1",l10:"5-5",pf:268,pa:261,div:"3-3",ats:"17-20",ats_p:46,ou:"14-23",ou_p:38,rl_m:"11-26",rl_p:"26-11",hot:false},
    {a:"ATL",w:7, l:10,pct:".412",gb:"2",stk:"W1",l10:"5-5",pf:248,pa:271,div:"2-4",ats:"16-21",ats_p:43,ou:"17-20",ou_p:46,rl_m:"10-27",rl_p:"27-10",hot:false},
    {a:"CAR",w:2, l:15,pct:".118",gb:"7",stk:"L8",l10:"1-9",pf:174,pa:348,div:"0-6",ats:"11-26",ats_p:30,ou:"12-25",ou_p:32,rl_m:"4-33", rl_p:"33-4", hot:false},
  ],
  "NFC West":[
    {a:"SF", w:12,l:5,pct:".706",gb:"—", stk:"W3",l10:"8-2",pf:358,pa:228,div:"4-2",ats:"21-16",ats_p:57,ou:"15-22",ou_p:41,rl_m:"17-20",rl_p:"20-17",hot:true},
    {a:"LAR",w:10,l:7,pct:".588",gb:"2", stk:"L1",l10:"6-4",pf:288,pa:258,div:"3-3",ats:"19-18",ats_p:51,ou:"18-19",ou_p:49,rl_m:"13-24",rl_p:"24-13",hot:false},
    {a:"SEA",w:9, l:8,pct:".529",gb:"3", stk:"W2",l10:"5-5",pf:268,pa:261,div:"2-4",ats:"18-19",ats_p:49,ou:"17-20",ou_p:46,rl_m:"12-25",rl_p:"25-12",hot:false},
    {a:"ARI",w:4, l:13,pct:".235",gb:"8",stk:"L5",l10:"2-8",pf:198,pa:334,div:"1-5",ats:"13-24",ats_p:35,ou:"16-21",ou_p:43,rl_m:"6-31", rl_p:"31-6", hot:false},
  ],
};


// ── STANDINGS DATA ────────────────────────────────────────────────────────────
var MLB_DIVISIONS = ["AL East","AL Central","AL West","NL East","NL Central","NL West"];
var MLB_STANDINGS = {
  "AL East":[
    {a:"NYY",w:52,l:28,pct:".650",gb:"—", stk:"W4",l10:"7-3",ats:"32-46",ats_p:41,ou:"38-40",ou_p:49,rl_m:"28-50",rl_p:"50-28",hot:true},
    {a:"BOS",w:44,l:36,pct:".550",gb:"8", stk:"L2",l10:"5-5",ats:"40-40",ats_p:50,ou:"41-38",ou_p:52,rl_m:"32-47",rl_p:"47-32",hot:false},
    {a:"TOR",w:42,l:38,pct:".525",gb:"10",stk:"W1",l10:"6-4",ats:"41-39",ats_p:51,ou:"40-39",ou_p:51,rl_m:"30-49",rl_p:"49-30",hot:false},
    {a:"BAL",w:40,l:40,pct:".500",gb:"12",stk:"W2",l10:"5-5",ats:"42-38",ats_p:53,ou:"44-35",ou_p:56,rl_m:"28-51",rl_p:"51-28",hot:false},
    {a:"TB", w:36,l:44,pct:".450",gb:"16",stk:"L3",l10:"4-6",ats:"38-42",ats_p:48,ou:"36-43",ou_p:46,rl_m:"24-55",rl_p:"55-24",hot:false},
  ],
  "AL Central":[
    {a:"MIN",w:48,l:32,pct:".600",gb:"—", stk:"W3",l10:"7-3",ats:"44-36",ats_p:55,ou:"40-39",ou_p:51,rl_m:"34-45",rl_p:"45-34",hot:true},
    {a:"CLE",w:45,l:35,pct:".563",gb:"3", stk:"W1",l10:"6-4",ats:"43-37",ats_p:54,ou:"38-41",ou_p:48,rl_m:"32-47",rl_p:"47-32",hot:false},
    {a:"KC", w:41,l:39,pct:".513",gb:"7", stk:"L1",l10:"5-5",ats:"40-40",ats_p:50,ou:"39-40",ou_p:49,rl_m:"29-50",rl_p:"50-29",hot:false},
    {a:"DET",w:38,l:42,pct:".475",gb:"10",stk:"W2",l10:"5-5",ats:"39-41",ats_p:49,ou:"37-42",ou_p:47,rl_m:"26-53",rl_p:"53-26",hot:false},
    {a:"CWS",w:22,l:58,pct:".275",gb:"26",stk:"L5",l10:"2-8",ats:"35-45",ats_p:44,ou:"34-45",ou_p:43,rl_m:"14-65",rl_p:"65-14",hot:false},
  ],
  "AL West":[
    {a:"HOU",w:49,l:31,pct:".613",gb:"—", stk:"W2",l10:"6-4",ats:"45-35",ats_p:56,ou:"41-38",ou_p:52,rl_m:"36-43",rl_p:"43-36",hot:true},
    {a:"SEA",w:46,l:34,pct:".575",gb:"3", stk:"W4",l10:"8-2",ats:"46-34",ats_p:58,ou:"36-43",ou_p:46,rl_m:"34-45",rl_p:"45-34",hot:true},
    {a:"TEX",w:42,l:38,pct:".525",gb:"7", stk:"L2",l10:"5-5",ats:"40-40",ats_p:50,ou:"42-37",ou_p:53,rl_m:"30-49",rl_p:"49-30",hot:false},
    {a:"LAA",w:34,l:46,pct:".425",gb:"15",stk:"L4",l10:"3-7",ats:"36-44",ats_p:45,ou:"40-39",ou_p:51,rl_m:"22-57",rl_p:"57-22",hot:false},
    {a:"OAK",w:28,l:52,pct:".350",gb:"21",stk:"L3",l10:"3-7",ats:"34-46",ats_p:43,ou:"35-44",ou_p:44,rl_m:"18-61",rl_p:"61-18",hot:false},
  ],
  "NL East":[
    {a:"PHI",w:50,l:30,pct:".625",gb:"—", stk:"W3",l10:"7-3",ats:"46-34",ats_p:58,ou:"42-37",ou_p:53,rl_m:"36-43",rl_p:"43-36",hot:true},
    {a:"ATL",w:47,l:33,pct:".588",gb:"3", stk:"W2",l10:"6-4",ats:"44-36",ats_p:55,ou:"40-39",ou_p:51,rl_m:"34-45",rl_p:"45-34",hot:true},
    {a:"NYM",w:43,l:37,pct:".538",gb:"7", stk:"L1",l10:"5-5",ats:"41-39",ats_p:51,ou:"41-38",ou_p:52,rl_m:"30-49",rl_p:"49-30",hot:false},
    {a:"MIA",w:32,l:48,pct:".400",gb:"18",stk:"L4",l10:"3-7",ats:"36-44",ats_p:45,ou:"34-45",ou_p:43,rl_m:"20-59",rl_p:"59-20",hot:false},
    {a:"WSH",w:30,l:50,pct:".375",gb:"20",stk:"W1",l10:"4-6",ats:"35-45",ats_p:44,ou:"36-43",ou_p:46,rl_m:"18-61",rl_p:"61-18",hot:false},
  ],
  "NL Central":[
    {a:"MIL",w:47,l:33,pct:".588",gb:"—", stk:"W5",l10:"8-2",ats:"47-33",ats_p:59,ou:"37-42",ou_p:47,rl_m:"35-44",rl_p:"44-35",hot:true},
    {a:"CHC",w:43,l:37,pct:".538",gb:"4", stk:"W2",l10:"6-4",ats:"42-38",ats_p:53,ou:"40-39",ou_p:51,rl_m:"30-49",rl_p:"49-30",hot:false},
    {a:"STL",w:40,l:40,pct:".500",gb:"7", stk:"L3",l10:"4-6",ats:"39-41",ats_p:49,ou:"38-41",ou_p:48,rl_m:"28-51",rl_p:"51-28",hot:false},
    {a:"PIT",w:36,l:44,pct:".450",gb:"11",stk:"L2",l10:"4-6",ats:"37-43",ats_p:46,ou:"36-43",ou_p:46,rl_m:"24-55",rl_p:"55-24",hot:false},
    {a:"CIN",w:34,l:46,pct:".425",gb:"13",stk:"W1",l10:"4-6",ats:"36-44",ats_p:45,ou:"37-42",ou_p:47,rl_m:"22-57",rl_p:"57-22",hot:false},
  ],
  "NL West":[
    {a:"LAD",w:54,l:26,pct:".675",gb:"—", stk:"W6",l10:"9-1",ats:"48-32",ats_p:60,ou:"44-35",ou_p:56,rl_m:"40-39",rl_p:"39-40",hot:true},
    {a:"SD", w:46,l:34,pct:".575",gb:"8", stk:"L1",l10:"6-4",ats:"44-36",ats_p:55,ou:"39-40",ou_p:49,rl_m:"34-45",rl_p:"45-34",hot:false},
    {a:"ARI",w:43,l:37,pct:".538",gb:"11",stk:"W3",l10:"6-4",ats:"43-37",ats_p:54,ou:"40-39",ou_p:51,rl_m:"31-48",rl_p:"48-31",hot:false},
    {a:"SF", w:39,l:41,pct:".488",gb:"15",stk:"W1",l10:"5-5",ats:"40-40",ats_p:50,ou:"38-41",ou_p:48,rl_m:"27-52",rl_p:"52-27",hot:false},
    {a:"COL",w:24,l:56,pct:".300",gb:"30",stk:"L6",l10:"1-9",ats:"32-48",ats_p:40,ou:"46-33",ou_p:58,rl_m:"14-65",rl_p:"65-14",hot:false},
  ],
};


function StandingsTab(props) {
  var sport = props.sport || "mlb";
  var viewArr = useState("Game Stats");
  var view = viewArr[0]; var setView = viewArr[1];
  var lgArr = useState(sport==="nfl"?"AFC":"AL");
  var lg = lgArr[0]; var setLg = lgArr[1];

  var divKeys = sport==="nfl"
    ? NFL_CONF_DIVISIONS.filter(function(d){ return d.indexOf(lg)===0; })
    : MLB_DIVISIONS.filter(function(d){ return d.indexOf(lg)===0; });

  return (
    <div style={{paddingBottom:80,animation:"fadeUp .2s ease"}}>
      <div style={{padding:"14px 14px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12,
          background:CARD,borderRadius:12,padding:4,border:"1px solid "+BORDER}}>
          {["Game Stats","Betting Stats"].map(function(v) {
            var isActive = view===v;
            return (
              <button key={v} onClick={function(){setView(v);}}
                style={{padding:"8px",borderRadius:9,fontSize:12,fontWeight:isActive?700:500,
                  cursor:"pointer",border:"none",
                  background:isActive?ACCENT:"transparent",
                  color:isActive?"#fff":MUTED}}>
                {v==="Game Stats"?"📊 Game Stats":"💰 Betting Stats"}
              </button>
            );
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
          {(sport==="nfl"?["AFC","NFC"]:["AL","NL"]).map(function(l) {
            var isActive = lg===l;
            var label = sport==="nfl"
              ? (l==="AFC"?"AFC":"NFC")
              : (l==="AL"?"American League":"National League");
            return (
              <button key={l} onClick={function(){setLg(l);}}
                style={{padding:"10px",borderRadius:12,fontSize:13,fontWeight:700,
                  cursor:"pointer",border:"2px solid "+(isActive?ACCENT:BORDER),
                  background:isActive?ACCENT+"22":"transparent",
                  color:isActive?ACCENT:TEXT2}}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {sport!=="mlb" && sport!=="nfl" && (
        <div style={{padding:"40px 20px",textAlign:"center",color:MUTED,fontSize:12}}>
          {sport.toUpperCase()} standings coming soon.
        </div>
      )}

      {(sport==="mlb" || sport==="nfl") && divKeys.map(function(div) {
        var teams = (sport==="nfl"?NFL_STANDINGS:MLB_STANDINGS)[div] || [];
        return (
          <div key={div} style={{marginBottom:16}}>
            <div style={{padding:"4px 14px 6px",fontSize:10,fontWeight:800,
              color:ACCENT,letterSpacing:".1em"}}>{div.toUpperCase()}</div>
            <div style={{background:CARD,border:"1px solid "+BORDER,
              borderRadius:14,overflow:"hidden",marginLeft:14,marginRight:14}}>

              {view==="Game Stats" && (
                <div>
                  <div style={{display:"grid",
                    gridTemplateColumns:"24px 2fr 30px 30px 48px 30px 44px 40px",
                    padding:"7px 12px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
                    {["#","TEAM","W","L","PCT","GB","STK","L10"].map(function(h) {
                      return (
                        <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                          textAlign:h==="#"||h==="TEAM"?"left":"center"}}>{h}</div>
                      );
                    })}
                  </div>
                  {teams.map(function(t, i) {
                    var tc = (sport==="nfl"?NFL_TEAM_C:TEAM_C)[t.a] || ACCENT;
                    var stkColor = t.stk.charAt(0)==="W"?POS_C:NEG_C;
                    return (
                      <div key={t.a} style={{display:"grid",
                        gridTemplateColumns:"24px 2fr 30px 30px 48px 30px 44px 40px",
                        padding:"9px 12px",alignItems:"center",
                        borderBottom:i<teams.length-1?"1px solid "+BORDER:"none",
                        background:i===0?tc+"08":"transparent"}}>
                        <div style={{fontSize:10,color:MUTED}}>{i+1}</div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          {t.hot && <span style={{fontSize:9}}>🔥</span>}
                          <span style={{fontSize:11,fontWeight:700,
                            color:i===0?tc:TEXT}}>{t.a}</span>
                        </div>
                        <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                          color:POS_C,fontFamily:"'IBM Plex Mono',monospace"}}>{t.w}</div>
                        <div style={{textAlign:"center",fontSize:11,color:NEG_C,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{t.l}</div>
                        <div style={{textAlign:"center",fontSize:11,color:TEXT2,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{t.pct}</div>
                        <div style={{textAlign:"center",fontSize:11,color:MUTED,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{t.gb}</div>
                        <div style={{textAlign:"center",fontSize:10,fontWeight:700,
                          color:stkColor,fontFamily:"'IBM Plex Mono',monospace"}}>{t.stk}</div>
                        <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{t.l10}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view==="Betting Stats" && (
                <div>
                  <div style={{display:"grid",
                    gridTemplateColumns:"24px 2fr 56px 56px 56px 56px",
                    padding:"7px 12px",background:CARD3,borderBottom:"1px solid "+BORDER}}>
                    {["#","TEAM","ATS","O/U","RL -1.5","RL +1.5"].map(function(h) {
                      return (
                        <div key={h} style={{fontSize:9,fontWeight:700,color:MUTED,
                          textAlign:h==="#"||h==="TEAM"?"left":"center"}}>{h}</div>
                      );
                    })}
                  </div>
                  {teams.map(function(t, i) {
                    var tc = (sport==="nfl"?NFL_TEAM_C:TEAM_C)[t.a] || ACCENT;
                    var atsColor = t.ats_p>=55?POS_C:t.ats_p<=45?NEG_C:TEXT2;
                    var ouColor = t.ou_p>=55?NEG_C:t.ou_p<=45?POS_C:TEXT2;
                    return (
                      <div key={t.a} style={{display:"grid",
                        gridTemplateColumns:"24px 2fr 56px 56px 56px 56px",
                        padding:"9px 12px",alignItems:"center",
                        borderBottom:i<teams.length-1?"1px solid "+BORDER:"none",
                        background:i===0?tc+"08":"transparent"}}>
                        <div style={{fontSize:10,color:MUTED}}>{i+1}</div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          {t.hot && <span style={{fontSize:9}}>🔥</span>}
                          <span style={{fontSize:11,fontWeight:700,
                            color:i===0?tc:TEXT}}>{t.a}</span>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:10,fontWeight:700,color:atsColor,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{t.ats}</div>
                          <div style={{fontSize:8,color:atsColor}}>{t.ats_p}%</div>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:10,fontWeight:700,color:ouColor,
                            fontFamily:"'IBM Plex Mono',monospace"}}>{t.ou}</div>
                          <div style={{fontSize:8,color:MUTED}}>{t.ou_p}% O</div>
                        </div>
                        <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{t.rl_m}</div>
                        <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                          fontFamily:"'IBM Plex Mono',monospace"}}>{t.rl_p}</div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        );
      })}

      {view==="Betting Stats" && (
        <div style={{margin:"0 14px 14px",padding:"10px 14px",background:AGL,
          borderRadius:12,border:"1px solid rgba(77,159,255,.2)"}}>
          <div style={{fontSize:9,fontWeight:800,color:ACCENT,
            letterSpacing:".1em",marginBottom:4}}>BETTING KEY</div>
          <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
            ATS = Against the Spread · O/U = Over/Under ·
            RL -1.5 = favored run line · RL +1.5 = underdog ·
            Green = 55%+ · Red = 45% or below
          </div>
        </div>
      )}
    {(sport==="nba"||sport==="nhl") && (
        <div style={{padding:"60px 24px",textAlign:"center",animation:"fadeUp .2s ease"}}>
          <div style={{fontSize:48,marginBottom:16}}>{sport==="nba"?"🏀":"🏒"}</div>
          <div style={{fontSize:18,fontWeight:900,color:TEXT,marginBottom:8}}>
            {sport==="nba"?"NBA":"NHL"} Coming Soon
          </div>
          <div style={{fontSize:12,color:MUTED,lineHeight:1.7,
            maxWidth:280,margin:"8px auto 24px"}}>
            {sport==="nba"?"NBA":"NHL"} coverage is in development.
            Check back soon for full standings, leaders, and analysis.
          </div>
          <div style={{display:"inline-block",padding:"8px 20px",borderRadius:20,
            background:ACCENT+"22",border:"1px solid "+ACCENT+"44",
            fontSize:11,fontWeight:700,color:ACCENT}}>
            In Development
          </div>
        </div>
      )}
    </div>
  );
}


// ── ACCOUNT DATA ──────────────────────────────────────────────────────────────
var ACCOUNT_DATA = {
  user:{name:"SharpUser",initials:"S",color:"#2563eb",tier:"Pro",
    tierColor:"#4d9fff",sport:"NFL",since:"Jun 2026"},
  stats:{record:{w:9,l:4,p:1},roi:38.2,staked:510,returned:705,
    streak:{type:"W",count:2},winRate:69,units:7.8},
  pending:[
    {bet:"KC -3 Cover",            sport:"NFL",type:"Spread",    stake:50, odds:"-110"},
    {bet:"Kelce Rec Yds Over 54.5",sport:"NFL",type:"Player Prop",stake:25,odds:"-118"},
    {bet:"Cole K8.5+ / Under 8.5", sport:"MLB",type:"Parlay",    stake:25, odds:"+245"},
  ],
  history:[
    {id:1, sport:"NFL",bet:"KC -3 Cover",             date:"Jan 5", type:"Spread",     odds:"-110",stake:50, result:"W",profit:45},
    {id:2, sport:"NFL",bet:"Kelce Over 54.5 Rec Yds", date:"Jan 5", type:"Player Prop",odds:"-115",stake:30, result:"W",profit:26},
    {id:3, sport:"NFL",bet:"BUF/KC Under 47.5",       date:"Jan 5", type:"Total",      odds:"-108",stake:40, result:"W",profit:37},
    {id:4, sport:"NFL",bet:"Josh Allen Pass Yds O284.5",date:"Jan 5",type:"Player Prop",odds:"-112",stake:25,result:"L",profit:25},
    {id:5, sport:"NFL",bet:"Pacheco Anytime TD",       date:"Dec 29",type:"Player Prop",odds:"+115",stake:20, result:"W",profit:23},
    {id:6, sport:"NFL",bet:"KC ML",                    date:"Dec 22",type:"ML",         odds:"-165",stake:50, result:"W",profit:30},
    {id:7, sport:"MLB",bet:"Cole Over 8.5 K",          date:"Jun 21",type:"Player Prop",odds:"-118",stake:50, result:"W",profit:42},
    {id:8, sport:"MLB",bet:"NYY/BOS Under 8.5",        date:"Jun 21",type:"Total",      odds:"-110",stake:30, result:"W",profit:27},
    {id:9, sport:"MLB",bet:"LAD ML",                   date:"Jun 20",type:"ML",         odds:"-145",stake:50, result:"L",profit:50},
    {id:10,sport:"MLB",bet:"Judge HR Anytime",         date:"Jun 20",type:"Player Prop",odds:"+310",stake:20, result:"W",profit:62},
    {id:11,sport:"MLB",bet:"Soto 1+ Hit",              date:"Jun 19",type:"Player Prop",odds:"-165",stake:40, result:"W",profit:24},
    {id:12,sport:"MLB",bet:"NYY -1.5 Run Line",        date:"Jun 19",type:"Run Line",   odds:"+112",stake:30, result:"L",profit:30},
    {id:13,sport:"MLB",bet:"Cole Over 8.5 K",          date:"Jun 18",type:"Player Prop",odds:"-118",stake:50, result:"W",profit:42},
    {id:14,sport:"MLB",bet:"BOS/NYY Over 9.0",         date:"Jun 18",type:"Total",      odds:"-108",stake:25, result:"P",profit:0},
  ],
  favorites:{
    betTypes:[
      {type:"Player Props",count:18,hitRate:72,icon:"🎯"},
      {type:"Spreads",     count:8, hitRate:63,icon:"📈"},
      {type:"Totals",      count:10,hitRate:60,icon:"📋"},
      {type:"Parlays",     count:4, hitRate:25,icon:"🏦"},
    ],
    teams:[
      {abbr:"KC", name:"Kansas City Chiefs", sport:"NFL",bets:8, mlRecord:"6-2",atsRecord:"5-3",hot:true},
      {abbr:"NYY",name:"New York Yankees",   sport:"MLB",bets:8, mlRecord:"5-3",atsRecord:"6-2",hot:true},
      {abbr:"BUF",name:"Buffalo Bills",      sport:"NFL",bets:5, mlRecord:"3-2",atsRecord:"4-1",hot:false},
      {abbr:"LAD",name:"Los Angeles Dodgers",sport:"MLB",bets:5, mlRecord:"3-2",atsRecord:"2-3",hot:false},
    ],
    players:[
      {name:"Travis Kelce", prop:"Over 54.5 Rec Yds",sport:"NFL",bets:4,hitRate:77,streak:"W3",hot:true},
      {name:"Gerrit Cole",  prop:"Over 8.5 K",       sport:"MLB",bets:4,hitRate:75,streak:"W3",hot:true},
      {name:"Patrick Mahomes",prop:"Pass Yds O284.5", sport:"NFL",bets:3,hitRate:73,streak:"W2",hot:true},
      {name:"Juan Soto",    prop:"Anytime Hit",       sport:"MLB",bets:3,hitRate:100,streak:"W3",hot:true},
      {name:"Josh Allen",   prop:"Pass Yds O284.5",   sport:"NFL",bets:3,hitRate:58,streak:"L1",hot:false},
      {name:"Aaron Judge",  prop:"Anytime HR",        sport:"MLB",bets:3,hitRate:67,streak:"W1",hot:true},
    ],
  },
  settings:{sportsbook:"DraftKings",oddsFormat:"American",
    notifications:true,edgeThreshold:70,defaultSport:"NFL"},
};


function AccountTab() {
  var tabArr = useState("Bet Tracker");
  var tab = tabArr[0]; var setTab = tabArr[1];
  var showLogArr = useState(false);
  var showLog = showLogArr[0]; var setShowLog = showLogArr[1];
  var expandTeamArr = useState(null);
  var expandTeam = expandTeamArr[0]; var setExpandTeam = expandTeamArr[1];
  var expandPlayerArr = useState(null);
  var expandPlayer = expandPlayerArr[0]; var setExpandPlayer = expandPlayerArr[1];
  var sbookArr = useState(ACCOUNT_DATA.settings.sportsbook);
  var sbook = sbookArr[0]; var setSbook = sbookArr[1];
  var oddsArr = useState(ACCOUNT_DATA.settings.oddsFormat);
  var oddsFormat = oddsArr[0]; var setOddsFormat = oddsArr[1];
  var notifsArr = useState(ACCOUNT_DATA.settings.notifications);
  var notifs = notifsArr[0]; var setNotifs = notifsArr[1];
  var threshArr = useState(ACCOUNT_DATA.settings.edgeThreshold);
  var thresh = threshArr[0]; var setThresh = threshArr[1];

  var u = ACCOUNT_DATA.user;
  var s = ACCOUNT_DATA.stats;
  var fav = ACCOUNT_DATA.favorites;

  return (
    <div style={{paddingBottom:80,animation:"fadeUp .25s ease"}}>

      {/* Profile Card */}
      <div style={{margin:"14px 14px 12px",background:CARD,
        border:"1px solid "+BORDER,borderRadius:16,padding:"16px"}}>
        <div style={{display:"flex",alignItems:"center",
          justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:52,height:52,borderRadius:14,
              background:"linear-gradient(135deg,"+u.color+",#1d4ed8)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:22,fontWeight:900,color:"#fff",flexShrink:0}}>
              {u.initials}
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:TEXT}}>{u.name}</div>
              <div style={{fontSize:11,color:MUTED,marginTop:2}}>
                Member since {u.since} · {u.sport}
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:4,
                marginTop:4,padding:"2px 8px",borderRadius:10,
                background:u.tierColor+"22",border:"1px solid "+u.tierColor+"44"}}>
                <span style={{fontSize:9,fontWeight:800,color:u.tierColor}}>
                  ⭐ {u.tier}
                </span>
              </div>
            </div>
          </div>
          <button style={{padding:"6px 12px",borderRadius:10,fontSize:11,
            fontWeight:600,cursor:"pointer",background:CARD3,
            border:"1px solid "+BORDER,color:TEXT2}}>
            Edit
          </button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {[
            {label:"Record", val:s.record.w+"-"+s.record.l+(s.record.p?"-"+s.record.p:""), color:POS_C},
            {label:"ROI",    val:s.roi+"%",   color:POS_C},
            {label:"Staked", val:"$"+s.staked, color:TEXT},
            {label:"Return", val:"$"+s.returned, color:POS_C},
          ].map(function(stat) {
            return (
              <div key={stat.label} style={{background:CARD3,borderRadius:10,
                padding:"10px 6px",textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:900,color:stat.color,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{stat.val}</div>
                <div style={{fontSize:9,color:MUTED,marginTop:3}}>{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Selector */}
      <div style={{margin:"0 14px 14px",background:CARD,borderRadius:12,
        padding:4,border:"1px solid "+BORDER,
        display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
        {[
          ["Bet Tracker","📋"],
          ["Favorites","⭐"],
          ["Settings","⚙️"],
        ].map(function(item) {
          var id = item[0]; var icon = item[1];
          var isActive = tab===id;
          return (
            <button key={id} onClick={function(){setTab(id);}}
              style={{padding:"8px 4px",borderRadius:9,fontSize:11,
                fontWeight:isActive?700:500,cursor:"pointer",border:"none",
                background:isActive?ACCENT:"transparent",
                color:isActive?"#fff":MUTED}}>
              {icon} {id}
            </button>
          );
        })}
      </div>

      {/* BET TRACKER */}
      {tab==="Bet Tracker" && (
        <div style={{padding:"0 14px"}}>
          {ACCOUNT_DATA.pending.length > 0 && (
            <div style={{background:"rgba(251,191,36,.08)",
              border:"1px solid rgba(251,191,36,.25)",
              borderRadius:12,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:9,fontWeight:800,color:WARN_C,
                letterSpacing:".1em",marginBottom:8}}>
                ⏳ PENDING ({ACCOUNT_DATA.pending.length})
              </div>
              {ACCOUNT_DATA.pending.map(function(p, i) {
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:TEXT}}>
                        {p.bet}
                      </div>
                      <div style={{fontSize:10,color:MUTED,marginTop:2}}>
                        {p.type} · {p.odds}
                      </div>
                    </div>
                    <div style={{fontSize:14,fontWeight:800,color:WARN_C,
                      fontFamily:"'IBM Plex Mono',monospace"}}>
                      {"$"+p.stake}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{display:"flex",alignItems:"center",
            justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:MUTED,
              letterSpacing:".1em"}}>BET HISTORY</div>
            <button onClick={function(){setShowLog(true);}}
              style={{padding:"5px 12px",borderRadius:10,fontSize:11,
                fontWeight:700,cursor:"pointer",background:ACCENT,
                border:"none",color:"#fff"}}>
              + Log Bet
            </button>
          </div>

          {ACCOUNT_DATA.history.map(function(bet) {
            var isW = bet.result==="W";
            var isL = bet.result==="L";
            var resultColor = isW?POS_C:isL?NEG_C:MUTED;
            var resultBg = isW?"rgba(52,211,153,.1)":isL?"rgba(255,90,90,.1)":"rgba(255,255,255,.05)";
            return (
              <div key={bet.id} style={{display:"flex",alignItems:"center",
                gap:12,padding:"11px 0",
                borderBottom:"1px solid "+BORDER}}>
                <div style={{width:30,height:30,borderRadius:9,
                  background:resultBg,border:"1px solid "+resultColor+"44",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  flexShrink:0}}>
                  <span style={{fontSize:13,color:resultColor,fontWeight:800}}>
                    {isW?"v":isL?"x":"—"}
                  </span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:TEXT,
                    overflow:"hidden",textOverflow:"ellipsis",
                    whiteSpace:"nowrap"}}>{bet.bet}</div>
                  <div style={{fontSize:10,color:MUTED,marginTop:2}}>
                    {bet.date} · {bet.type} · {bet.odds}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:resultColor,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {bet.profit>0?"+$"+bet.profit:bet.profit<0?"-$"+Math.abs(bet.profit):"Push"}
                  </div>
                  <div style={{fontSize:9,color:MUTED,marginTop:1}}>
                    {"$"+bet.stake+" staked"}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{marginTop:14,padding:"12px 14px",background:CARD,
            borderRadius:12,border:"1px solid "+BORDER}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {label:"Win Rate", val:s.winRate+"%", color:POS_C},
                {label:"Streak",   val:s.streak.type+s.streak.count, color:s.streak.type==="W"?POS_C:NEG_C},
                {label:"Units",    val:"+"+s.units, color:POS_C},
              ].map(function(stat) {
                return (
                  <div key={stat.label} style={{textAlign:"center",padding:"8px 4px",
                    background:CARD3,borderRadius:10}}>
                    <div style={{fontSize:16,fontWeight:800,color:stat.color,
                      fontFamily:"'IBM Plex Mono',monospace"}}>{stat.val}</div>
                    <div style={{fontSize:9,color:MUTED,marginTop:2}}>{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FAVORITES */}
      {tab==="Favorites" && (
        <div style={{padding:"0 14px"}}>

          {/* Bet Types */}
          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>MOST FREQUENT BET TYPES</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,overflow:"hidden",marginBottom:16}}>
            {fav.betTypes.map(function(bt, i) {
              var barW = bt.hitRate;
              var barColor = bt.hitRate>=70?POS_C:bt.hitRate>=55?ACCENT:NEG_C;
              return (
                <div key={i} style={{padding:"12px 14px",
                  borderBottom:i<fav.betTypes.length-1?"1px solid "+BORDER:"none"}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14}}>{bt.icon}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:TEXT}}>
                          {bt.type}
                        </div>
                        <div style={{fontSize:10,color:MUTED}}>{bt.count} bets placed</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:800,color:barColor,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {bt.hitRate}%
                      </div>
                      <div style={{fontSize:9,color:MUTED}}>hit rate</div>
                    </div>
                  </div>
                  <div style={{height:3,background:BORDER2,borderRadius:2,
                    overflow:"hidden"}}>
                    <div style={{height:"100%",width:barW+"%",
                      background:barColor,borderRadius:2}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Favorite Teams */}
          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>FAVORITE TEAMS</div>
          <div style={{marginBottom:16}}>
            {fav.teams.map(function(team, i) {
              var tc = TEAM_C[team.abbr] || ACCENT;
              var isExpanded = expandTeam===team.abbr;
              var mlWins = parseInt(team.mlRecord.split("-")[0]);
              var mlTotal = parseInt(team.mlRecord.split("-")[0])+parseInt(team.mlRecord.split("-")[1]);
              var mlRate = Math.round(mlWins/mlTotal*100);
              var atsWins = parseInt(team.atsRecord.split("-")[0]);
              var atsTotal = parseInt(team.atsRecord.split("-")[0])+parseInt(team.atsRecord.split("-")[1]);
              var atsRate = Math.round(atsWins/atsTotal*100);
              return (
                <div key={team.abbr} style={{background:CARD,
                  border:"1px solid "+(isExpanded?tc:BORDER),
                  borderRadius:14,marginBottom:8,overflow:"hidden"}}>
                  <div onClick={function(){setExpandTeam(isExpanded?null:team.abbr);}}
                    style={{padding:"12px 14px",cursor:"pointer",
                      display:"flex",alignItems:"center",
                      justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:10,
                        background:tc+"22",border:"1px solid "+tc+"44",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,fontWeight:800,color:tc}}>
                        {team.abbr}
                      </div>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:13,fontWeight:700,color:TEXT}}>
                            {team.name}
                          </span>
                          {team.hot && <span style={{fontSize:10}}>🔥</span>}
                        </div>
                        <div style={{fontSize:10,color:MUTED,marginTop:2}}>
                          {team.bets} bets · ML {team.mlRecord} · ATS {team.atsRecord}
                        </div>
                      </div>
                    </div>
                    <span style={{color:TEXT2,fontSize:12}}>
                      {isExpanded?"▲":"▼"}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{borderTop:"1px solid "+BORDER,padding:"12px 14px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        {[
                          {label:"ML Record",  val:team.mlRecord, rate:mlRate,  color:mlRate>=60?POS_C:mlRate<=45?NEG_C:TEXT2},
                          {label:"ATS Record", val:team.atsRecord,rate:atsRate, color:atsRate>=60?POS_C:atsRate<=45?NEG_C:TEXT2},
                        ].map(function(stat) {
                          return (
                            <div key={stat.label} style={{background:CARD3,
                              borderRadius:10,padding:"10px 12px"}}>
                              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>
                                {stat.label}
                              </div>
                              <div style={{fontSize:16,fontWeight:800,
                                color:stat.color,fontFamily:"'IBM Plex Mono',monospace"}}>
                                {stat.val}
                              </div>
                              <div style={{fontSize:10,color:stat.color,marginTop:2}}>
                                {stat.rate}% hit rate
                              </div>
                              <div style={{height:3,background:BORDER2,borderRadius:2,
                                overflow:"hidden",marginTop:6}}>
                                <div style={{height:"100%",width:stat.rate+"%",
                                  background:stat.color,borderRadius:2}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{padding:"8px 12px",background:AGL,
                        borderRadius:8,border:"1px solid rgba(77,159,255,.2)"}}>
                        <div style={{fontSize:10,color:TEXT2}}>
                          {team.hot
                            ? "🔥 On a hot streak — both ML and ATS performing above average recently."
                            : "❄️ Below expectations recently — consider fading or reducing stake."}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Favorite Players */}
          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>FAVORITE PLAYER PROPS</div>
          <div style={{marginBottom:16}}>
            {fav.players.map(function(player, i) {
              var isExpanded = expandPlayer===player.name;
              var hitColor = player.hitRate>=70?POS_C:player.hitRate>=50?ACCENT:NEG_C;
              return (
                <div key={player.name} style={{background:CARD,
                  border:"1px solid "+(isExpanded?ACCENT:BORDER),
                  borderRadius:14,marginBottom:8,overflow:"hidden"}}>
                  <div onClick={function(){setExpandPlayer(isExpanded?null:player.name);}}
                    style={{padding:"12px 14px",cursor:"pointer",
                      display:"flex",alignItems:"center",
                      justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:10,
                        background:CARD3,border:"1px solid "+BORDER,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10,fontWeight:800,color:TEXT2}}>
                        {player.hot?"🔥":"❄️"}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:TEXT}}>
                          {player.name}
                        </div>
                        <div style={{fontSize:10,color:MUTED,marginTop:2}}>
                          {player.prop} · {player.bets} bets
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:14,fontWeight:800,color:hitColor,
                          fontFamily:"'IBM Plex Mono',monospace"}}>
                          {player.hitRate}%
                        </div>
                        <div style={{fontSize:9,color:MUTED}}>hit rate</div>
                      </div>
                      <span style={{color:TEXT2,fontSize:12}}>
                        {isExpanded?"▲":"▼"}
                      </span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{borderTop:"1px solid "+BORDER,padding:"12px 14px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
                        gap:8,marginBottom:10}}>
                        {[
                          {label:"Hit Rate",val:player.hitRate+"%",color:hitColor},
                          {label:"Bets",    val:player.bets,       color:TEXT},
                          {label:"Streak",  val:player.streak,
                            color:player.streak.startsWith("W")?POS_C:NEG_C},
                        ].map(function(stat) {
                          return (
                            <div key={stat.label} style={{background:CARD3,
                              borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                              <div style={{fontSize:16,fontWeight:800,
                                color:stat.color,fontFamily:"'IBM Plex Mono',monospace"}}>
                                {stat.val}
                              </div>
                              <div style={{fontSize:9,color:MUTED,marginTop:2}}>
                                {stat.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{height:4,background:BORDER2,borderRadius:2,
                        overflow:"hidden",marginBottom:8}}>
                        <div style={{height:"100%",width:player.hitRate+"%",
                          background:hitColor,borderRadius:2}}/>
                      </div>
                      <div style={{padding:"8px 12px",background:AGL,
                        borderRadius:8,border:"1px solid rgba(77,159,255,.2)"}}>
                        <div style={{fontSize:10,color:TEXT2}}>
                          {player.hot
                            ? "🔥 Hitting at an elite rate — strong lean to continue backing this prop."
                            : "❄️ Below 50% recently — consider smaller stake or skipping until form returns."}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab==="Settings" && (
        <div style={{padding:"0 14px"}}>
          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>SPORTSBOOK</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:14}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["DraftKings","FanDuel","BetMGM","Caesars","PointsBet"].map(function(sb) {
                var isActive = sbook===sb;
                return (
                  <button key={sb} onClick={function(){setSbook(sb);}}
                    style={{padding:"7px 14px",borderRadius:12,fontSize:11,
                      fontWeight:600,cursor:"pointer",
                      background:isActive?ACCENT+"22":"transparent",
                      border:"1px solid "+(isActive?ACCENT:BORDER),
                      color:isActive?ACCENT:TEXT2}}>
                    {sb}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>ODDS FORMAT</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:14}}>
            <div style={{display:"flex",gap:8}}>
              {["American","Decimal","Fractional"].map(function(fmt) {
                var isActive = oddsFormat===fmt;
                return (
                  <button key={fmt} onClick={function(){setOddsFormat(fmt);}}
                    style={{flex:1,padding:"8px 4px",borderRadius:12,fontSize:11,
                      fontWeight:600,cursor:"pointer",
                      background:isActive?ACCENT:"transparent",
                      border:"1px solid "+(isActive?ACCENT:BORDER),
                      color:isActive?"#fff":TEXT2}}>
                    {fmt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>EDGE ALERT THRESHOLD</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",
              justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,color:TEXT2}}>
                Only alert me for edges above:
              </span>
              <span style={{fontSize:16,fontWeight:800,color:ACCENT,
                fontFamily:"'IBM Plex Mono',monospace"}}>{thresh}%</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              {[60,65,70,75,80].map(function(t) {
                var isActive = thresh===t;
                return (
                  <button key={t} onClick={function(){setThresh(t);}}
                    style={{flex:1,padding:"7px 4px",borderRadius:10,
                      fontSize:11,fontWeight:600,cursor:"pointer",
                      background:isActive?ACCENT+"22":"transparent",
                      border:"1px solid "+(isActive?ACCENT:BORDER),
                      color:isActive?ACCENT:TEXT2}}>
                    {t}%
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>NOTIFICATIONS</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:14}}>
            {[
              {label:"Edge Alerts",    sub:"Notify when new edges are found",    on:true},
              {label:"Game Reminders", sub:"30 min before games you're tracking", on:true},
              {label:"Result Updates", sub:"Notify when tracked bets are graded", on:notifs},
            ].map(function(item, i) {
              return (
                <div key={i} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",
                  padding:i>0?"12px 0 0":"0",
                  marginTop:i>0?12:0,
                  borderTop:i>0?"1px solid "+BORDER:"none"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:TEXT}}>
                      {item.label}
                    </div>
                    <div style={{fontSize:10,color:MUTED,marginTop:2}}>
                      {item.sub}
                    </div>
                  </div>
                  <div onClick={function(){if(i===2)setNotifs(!notifs);}}
                    style={{width:44,height:24,borderRadius:12,cursor:"pointer",
                      background:item.on?ACCENT:BORDER2,
                      position:"relative",transition:"background .2s",
                      flexShrink:0}}>
                    <div style={{position:"absolute",
                      top:3,left:item.on?22:3,
                      width:18,height:18,borderRadius:9,
                      background:"#fff",transition:"left .2s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{fontSize:10,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:8}}>DEFAULT SPORT</div>
          <div style={{background:CARD,border:"1px solid "+BORDER,
            borderRadius:14,padding:"14px",marginBottom:14}}>
            <div style={{display:"flex",gap:8}}>
              {SPORTS.map(function(s) {
                var isActive = s.label===ACCOUNT_DATA.settings.defaultSport;
                return (
                  <button key={s.id}
                    style={{flex:1,padding:"8px 4px",borderRadius:12,fontSize:11,
                      fontWeight:isActive?700:500,cursor:"pointer",
                      background:isActive?ACCENT+"22":"transparent",
                      border:"1px solid "+(isActive?ACCENT:BORDER),
                      color:isActive?ACCENT:TEXT2}}>
                    {s.icon}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{padding:"12px 14px",background:"rgba(255,90,90,.06)",
            border:"1px solid rgba(255,90,90,.15)",borderRadius:12,marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:NEG_C,marginBottom:4}}>
              Manage Account
            </div>
            <div style={{fontSize:10,color:TEXT2,marginBottom:10}}>
              Upgrade plan, change password, or delete account.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{flex:1,padding:"8px",borderRadius:10,
                fontSize:11,fontWeight:600,cursor:"pointer",
                background:ACCENT+"22",border:"1px solid "+ACCENT+"44",
                color:ACCENT}}>
                Upgrade to Elite
              </button>
              <button style={{padding:"8px 12px",borderRadius:10,
                fontSize:11,fontWeight:600,cursor:"pointer",
                background:"transparent",border:"1px solid "+NEG_C+"44",
                color:NEG_C}}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Bet Modal */}
      {showLog && (
        <div style={{position:"fixed",inset:0,zIndex:400,
          background:"rgba(0,0,0,.82)",backdropFilter:"blur(12px)",
          display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={function(){setShowLog(false);}}>
          <div onClick={function(e){e.stopPropagation();}}
            style={{background:CARD2,border:"1px solid "+BORDER2,
              borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,
              padding:"22px 18px 36px",animation:"fadeUp .2s ease"}}>
            <div style={{display:"flex",alignItems:"center",
              justifyContent:"space-between",marginBottom:16}}>
              <span style={{fontSize:14,fontWeight:800,color:TEXT}}>
                Log a Bet
              </span>
              <button onClick={function(){setShowLog(false);}}
                style={{background:"none",border:"1px solid "+BORDER,
                  borderRadius:8,width:28,height:28,color:TEXT2,
                  cursor:"pointer",fontSize:14}}>
                x
              </button>
            </div>
            <div style={{padding:"20px",textAlign:"center",color:MUTED,
              fontSize:12,background:CARD3,borderRadius:12}}>
              Bet logging coming in next update. You'll be able to track
              stakes, odds, result, and notes for every bet.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  var tabArr = useState("home");
  var tab = tabArr[0]; var setTab = tabArr[1];
  var sportArr = useState("mlb");
  var sport = sportArr[0]; var setSport = sportArr[1];
  var timeArr = useState("14D");
  var timeWindow = timeArr[0]; var setTimeWindow = timeArr[1];
  var gameArr = useState(null);
  var selectedGame = gameArr[0]; var setSelectedGame = gameArr[1];
  var playerArr = useState(null);
  var selectedPlayer = playerArr[0]; var setSelectedPlayer = playerArr[1];

  var prevTabArr = useState("home");
  var prevTab = prevTabArr[0]; var setPrevTab = prevTabArr[1];

  function handleSelectGame(game) {
    setPrevTab(tab);
    setSelectedGame(game);
  }
  function handleBack() {
    setSelectedGame(null);
    setTab(prevTab);
  }
  function handleSelectPlayer(name) {
    setSelectedPlayer(name);
  }
  function handlePlayerBack() {
    setSelectedPlayer(null);
  }

  if(selectedPlayer) {
    return (<NFLPlayerPage playerName={selectedPlayer} onBack={handlePlayerBack}/>);
  }

  if(selectedGame) {
    return (<BreakdownPage game={selectedGame} onBack={handleBack} sport={sport} onSelectPlayer={handleSelectPlayer}/>);
  }

  return (
    <div style={{background:BG,minHeight:"100vh",color:TEXT,
      fontFamily:"'Inter',system-ui,sans-serif",maxWidth:540,margin:"0 auto",
      position:"relative"}}>
      <style>{APP_CSS}</style>
      <div style={{paddingBottom:4}}>
        {tab==="home"      && <HomeTab onSelectGame={handleSelectGame}
          onSelectPlayer={handleSelectPlayer}
          sport={sport} setSport={setSport}
          timeWindow={timeWindow} setTimeWindow={setTimeWindow}/>}
        {tab==="games"     && <GamesTab onSelectGame={handleSelectGame} onSelectPlayer={handleSelectPlayer} sport={sport}/>}
        {tab==="leaders"   && <LeadersTab sport={sport} onSelectPlayer={handleSelectPlayer}/>}
        {tab==="standings" && <StandingsTab sport={sport}/>}
        {tab==="account"   && <AccountTab/>}
      </div>
      <BottomNav active={tab} onChange={function(t){
        setTab(t);
        setSelectedGame(null);
      }}/>
    </div>
  );
}


// ── NFL PLAYER PAGE ───────────────────────────────────────────────────────────
function NFLPlayerPage(props) {
  var playerName = props.playerName;
  var onBack = props.onBack;
  var expandFormArr = useState(false);
  var expandForm = expandFormArr[0]; var setExpandForm = expandFormArr[1];

  var p = NFL_PLAYER_PAGES[playerName];
  if(!p) {
    return (
      <div style={{padding:"40px 20px",textAlign:"center",color:MUTED}}>
        <div style={{fontSize:14,marginBottom:8}}>Player not found</div>
        <button onClick={onBack}
          style={{padding:"8px 16px",borderRadius:10,background:ACCENT,
            border:"none",color:"#fff",cursor:"pointer"}}>Go Back</button>
      </div>
    );
  }

  var tc = NFL_TEAM_C[p.team] || ACCENT;
  var isQB = p.pos==="QB";
  var isRB = p.pos==="RB";
  var isTE = p.pos==="TE" || p.pos==="WR";
  var formRows = expandForm ? p.recentForm : p.recentForm.slice(0,5);

  return (
    <div style={{background:BG,minHeight:"100vh",color:TEXT,
      fontFamily:"'Inter',system-ui,sans-serif",maxWidth:540,margin:"0 auto"}}>
      <style>{APP_CSS}</style>

      <div style={{position:"sticky",top:0,zIndex:100,
        background:"rgba(8,13,24,.97)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid "+BORDER,padding:"12px 16px",
        display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack}
          style={{background:"none",border:"none",color:TEXT2,
            cursor:"pointer",fontSize:18,padding:"2px 6px"}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:900,color:TEXT}}>{p.name}</div>
          <div style={{fontSize:10,color:MUTED}}>{p.team} · {p.pos}</div>
        </div>
        {p.hot && <span style={{fontSize:16}}>🔥</span>}
        <div style={{width:32,height:32,borderRadius:10,
          background:tc+"22",border:"1px solid "+tc+"44",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:10,fontWeight:800,color:tc}}>{p.team}</div>
      </div>

      <div style={{padding:"14px",paddingBottom:40,animation:"fadeUp .2s ease"}}>

        <div style={{background:CARD,border:"2px solid "+tc+"44",
          borderRadius:16,padding:"16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:48,height:48,borderRadius:14,
              background:tc+"22",border:"2px solid "+tc+"44",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14,fontWeight:900,color:tc}}>{p.pos}</div>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:TEXT}}>{p.name}</div>
              <div style={{fontSize:11,color:MUTED}}>{p.headlineStat}</div>
            </div>
          </div>
          <div style={{display:"grid",
            gridTemplateColumns:isQB?"1fr 1fr 1fr 1fr":isRB?"1fr 1fr 1fr 1fr":"1fr 1fr 1fr 1fr",
            gap:8}}>
            {isQB && [
              {l:"Pass Yds",v:p.season.yds,  good:p.season.yds>=280},
              {l:"TDs",     v:p.season.tds,  good:p.season.tds>=2},
              {l:"Rating",  v:p.season.rating,good:p.season.rating>=95},
              {l:"Comp%",   v:p.season.comp, good:parseFloat(p.season.comp)>=65},
            ].map(function(s) {
              var c = s.good?POS_C:TEXT2;
              return (
                <div key={s.l} style={{background:CARD3,borderRadius:10,
                  padding:"8px 6px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:c,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{s.v}</div>
                  <div style={{fontSize:8,color:MUTED}}>{s.l}</div>
                </div>
              );
            })}
            {isRB && [
              {l:"Rush Yds",v:p.season.yds,  good:p.season.yds>=75},
              {l:"YPC",     v:p.season.ypc,  good:p.season.ypc>=4.5},
              {l:"TDs",     v:p.season.tds,  good:p.season.tds>=1},
              {l:"ATT",     v:p.season.att,  good:p.season.att>=15},
            ].map(function(s) {
              var c = s.good?POS_C:TEXT2;
              return (
                <div key={s.l} style={{background:CARD3,borderRadius:10,
                  padding:"8px 6px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:c,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{s.v}</div>
                  <div style={{fontSize:8,color:MUTED}}>{s.l}</div>
                </div>
              );
            })}
            {isTE && [
              {l:"Rec Yds", v:p.season.yds,     good:p.season.yds>=75},
              {l:"REC",     v:p.season.rec,     good:p.season.rec>=6},
              {l:"TDs",     v:p.season.tds,     good:p.season.tds>=1},
              {l:"Targets", v:p.season.targets, good:p.season.targets>=8},
            ].map(function(s) {
              var c = s.good?POS_C:TEXT2;
              return (
                <div key={s.l} style={{background:CARD3,borderRadius:10,
                  padding:"8px 6px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:c,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>{s.v}</div>
                  <div style={{fontSize:8,color:MUTED}}>{s.l}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"rgba(52,211,153,.06)",
          border:"1px solid rgba(52,211,153,.25)",
          borderRadius:14,padding:"14px",marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:800,color:WARN_C,
            letterSpacing:".1em",marginBottom:10}}>🎯 TONIGHT'S EDGE</div>
          <div style={{fontSize:11,color:MUTED,marginBottom:4}}>
            {p.tonightEdge.oppRank}
          </div>
          <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:8}}>
            {p.tonightEdge.propLine}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{background:CARD3,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>Season Record</div>
              <div style={{fontSize:16,fontWeight:900,color:POS_C,
                fontFamily:"'IBM Plex Mono',monospace"}}>{p.tonightEdge.rec}</div>
            </div>
            <div style={{background:CARD3,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:9,color:MUTED,marginBottom:4}}>Hit Rate</div>
              <div style={{fontSize:16,fontWeight:900,
                color:p.tonightEdge.pct>=60?POS_C:p.tonightEdge.pct<=40?NEG_C:TEXT2,
                fontFamily:"'IBM Plex Mono',monospace"}}>{p.tonightEdge.pct}%</div>
            </div>
          </div>
          <div style={{padding:"8px 10px",background:"rgba(52,211,153,.08)",
            borderRadius:8,marginBottom:6}}>
            <div style={{fontSize:9,fontWeight:800,color:POS_C,marginBottom:3}}>
              LEAN
            </div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              {p.tonightEdge.lean}
            </div>
          </div>
          <div style={{padding:"8px 10px",background:"rgba(255,90,90,.06)",
            borderRadius:8,border:"1px solid rgba(255,90,90,.15)"}}>
            <div style={{fontSize:9,fontWeight:800,color:NEG_C,marginBottom:3}}>
              RISK
            </div>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.5}}>
              {p.tonightEdge.risk}
            </div>
          </div>
        </div>

        <div style={{background:CARD,border:"1px solid "+BORDER,
          borderRadius:14,overflow:"hidden",marginBottom:14}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,letterSpacing:".1em"}}>
              RECENT FORM
            </div>
            <div style={{fontSize:9,color:ACCENT,fontWeight:700}}>
              {expandForm?"Last 10":"Last 5"}
            </div>
          </div>
          <div style={{display:"grid",
            gridTemplateColumns:isQB?"44px 56px 56px 44px 28px 28px 52px":
                                isRB?"44px 56px 36px 44px 44px 36px":"44px 56px 36px 36px 44px 36px",
            padding:"6px 12px",background:CARD3,
            borderBottom:"1px solid "+BORDER}}>
            {isQB && ["OPP","DATE","COMP","YDS","TD","INT","RATING"].map(function(h){
              return (<div key={h} style={{fontSize:8,fontWeight:700,
                color:MUTED,textAlign:"center"}}>{h}</div>);
            })}
            {isRB && ["OPP","DATE","ATT","YDS","YPC","TD"].map(function(h){
              return (<div key={h} style={{fontSize:8,fontWeight:700,
                color:MUTED,textAlign:"center"}}>{h}</div>);
            })}
            {isTE && ["OPP","DATE","TGT","REC","YDS","TD"].map(function(h){
              return (<div key={h} style={{fontSize:8,fontWeight:700,
                color:MUTED,textAlign:"center"}}>{h}</div>);
            })}
          </div>
          {formRows.map(function(g, i) {
            var rc = g.result==="W"?POS_C:NEG_C;
            return (
              <div key={i} style={{display:"grid",
                gridTemplateColumns:isQB?"44px 56px 56px 44px 28px 28px 52px":
                                    isRB?"44px 56px 36px 44px 44px 36px":"44px 56px 36px 36px 44px 36px",
                padding:"9px 12px",alignItems:"center",
                borderBottom:i<formRows.length-1?"1px solid "+BORDER:"none",
                background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                <div style={{textAlign:"center",fontSize:10,fontWeight:700,color:TEXT}}>
                  {g.opp}
                </div>
                <div style={{textAlign:"center",fontSize:9,color:MUTED}}>{g.date}</div>
                {isQB && (
                  <div style={{textAlign:"center",fontSize:9,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.comp}</div>
                )}
                {isQB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,color:TEXT,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                )}
                {isQB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.tds>0?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                )}
                {isQB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.ints>0?NEG_C:POS_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.ints}</div>
                )}
                {isQB && (
                  <div style={{textAlign:"center",fontSize:10,fontWeight:700,
                    color:g.rating>=100?POS_C:g.rating>=85?WARN_C:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.rating}</div>
                )}
                {isRB && (
                  <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.att}</div>
                )}
                {isRB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,color:TEXT,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                )}
                {isRB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.ypc>=5?POS_C:g.ypc<3.5?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.ypc}</div>
                )}
                {isRB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.tds>0?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                )}
                {isTE && (
                  <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.tgt}</div>
                )}
                {isTE && (
                  <div style={{textAlign:"center",fontSize:10,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.rec}</div>
                )}
                {isTE && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.yds>=70?POS_C:g.yds<40?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                )}
                {isTE && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.tds>0?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                )}
              </div>
            );
          })}
          <div onClick={function(){setExpandForm(!expandForm);}}
            style={{padding:"10px",textAlign:"center",fontSize:10,
              color:ACCENT,fontWeight:600,cursor:"pointer",
              borderTop:"1px solid "+BORDER}}>
            {expandForm?"Show Less ▲":"Show Last 10 ▼"}
          </div>
        </div>

        <div style={{background:CARD,border:"1px solid "+BORDER,
          borderRadius:14,padding:"14px",marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:10}}>PROP BETTING RECORD</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {p.propRecord.map(function(stat, i) {
              var color = stat.pct>=60?POS_C:stat.pct<=40?NEG_C:TEXT2;
              var bg = stat.pct>=60?"rgba(52,211,153,.07)":
                       stat.pct<=40?"rgba(255,90,90,.07)":"rgba(255,255,255,.03)";
              var bdr = stat.pct>=60?"rgba(52,211,153,.2)":
                        stat.pct<=40?"rgba(255,90,90,.2)":BORDER;
              return (
                <div key={i} style={{background:bg,border:"1px solid "+bdr,
                  borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:9,color:MUTED,marginBottom:4,lineHeight:1.3}}>
                    {stat.line}
                  </div>
                  <div style={{fontSize:16,fontWeight:900,color:color,
                    fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>
                    {stat.rec}
                  </div>
                  <div style={{height:2,background:BORDER2,borderRadius:1,
                    overflow:"hidden",marginBottom:4}}>
                    <div style={{height:"100%",width:stat.pct+"%",
                      background:color,borderRadius:1}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:color}}>
                    {stat.pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:CARD,border:"1px solid "+BORDER,
          borderRadius:14,padding:"14px",marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:800,color:MUTED,
            letterSpacing:".1em",marginBottom:12}}>
            BEST vs WORST MATCHUPS
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:9,fontWeight:800,color:POS_C,
                letterSpacing:".08em",marginBottom:8}}>🔥 BEST OPPONENTS</div>
              {p.bestOpponents.map(function(o, i) {
                return (
                  <div key={i} style={{background:"rgba(52,211,153,.06)",
                    border:"1px solid rgba(52,211,153,.15)",
                    borderRadius:10,padding:"10px",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",
                      justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:800,color:TEXT}}>{o.opp}</span>
                      <span style={{fontSize:9,color:MUTED}}>{o.games}G</span>
                    </div>
                    {isQB && (
                      <div style={{fontSize:11,fontWeight:700,color:POS_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {o.avgYds} yds · {o.avgTds} TDs
                      </div>
                    )}
                    {isRB && (
                      <div style={{fontSize:11,fontWeight:700,color:POS_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {o.avgYds} yds · {o.ypc} YPC
                      </div>
                    )}
                    {isTE && (
                      <div style={{fontSize:11,fontWeight:700,color:POS_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {o.avgYds} yds · {o.avgRec} rec
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{fontSize:9,fontWeight:800,color:NEG_C,
                letterSpacing:".08em",marginBottom:8}}>❄️ WORST OPPONENTS</div>
              {p.worstOpponents.map(function(o, i) {
                return (
                  <div key={i} style={{background:"rgba(255,90,90,.06)",
                    border:"1px solid rgba(255,90,90,.15)",
                    borderRadius:10,padding:"10px",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",
                      justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:800,color:TEXT}}>{o.opp}</span>
                      <span style={{fontSize:9,color:MUTED}}>{o.games}G</span>
                    </div>
                    {isQB && (
                      <div style={{fontSize:11,fontWeight:700,color:NEG_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {o.avgYds} yds · {o.avgTds} TDs
                      </div>
                    )}
                    {isRB && (
                      <div style={{fontSize:11,fontWeight:700,color:NEG_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {o.avgYds} yds · {o.ypc} YPC
                      </div>
                    )}
                    {isTE && (
                      <div style={{fontSize:11,fontWeight:700,color:NEG_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {o.avgYds} yds · {o.avgRec} rec
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{marginTop:12}}>
            <div style={{fontSize:9,fontWeight:800,color:MUTED,
              letterSpacing:".1em",marginBottom:10}}>VENUE SPLITS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:9,fontWeight:800,color:POS_C,
                  letterSpacing:".08em",marginBottom:8}}>🏟 BEST VENUES</div>
                {p.bestVenues.map(function(v, i) {
                  return (
                    <div key={i} style={{background:"rgba(52,211,153,.06)",
                      border:"1px solid rgba(52,211,153,.15)",
                      borderRadius:10,padding:"8px 10px",marginBottom:6}}>
                      <div style={{fontSize:10,fontWeight:700,color:TEXT,
                        marginBottom:3,lineHeight:1.3}}>{v.venue}</div>
                      <div style={{fontSize:11,fontWeight:700,color:POS_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {v.avgYds} yds avg
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div style={{fontSize:9,fontWeight:800,color:NEG_C,
                  letterSpacing:".08em",marginBottom:8}}>🏟 WORST VENUES</div>
                {p.worstVenues.map(function(v, i) {
                  return (
                    <div key={i} style={{background:"rgba(255,90,90,.06)",
                      border:"1px solid rgba(255,90,90,.15)",
                      borderRadius:10,padding:"8px 10px",marginBottom:6}}>
                      <div style={{fontSize:10,fontWeight:700,color:TEXT,
                        marginBottom:3,lineHeight:1.3}}>{v.venue}</div>
                      <div style={{fontSize:11,fontWeight:700,color:NEG_C,
                        fontFamily:"'IBM Plex Mono',monospace"}}>
                        {v.avgYds} yds avg
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={{background:CARD,border:"1px solid "+BORDER,
          borderRadius:14,overflow:"hidden",marginBottom:14}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid "+BORDER,
            background:"rgba(251,191,36,.06)"}}>
            <div style={{fontSize:9,fontWeight:800,color:WARN_C,
              letterSpacing:".1em",marginBottom:2}}>
              CAREER VS {p.careerVsTonight.opp.toUpperCase()}
            </div>
            <div style={{display:"flex",gap:16,marginTop:6}}>
              <div>
                <div style={{fontSize:9,color:MUTED}}>Games</div>
                <div style={{fontSize:14,fontWeight:800,color:TEXT,
                  fontFamily:"'IBM Plex Mono',monospace"}}>
                  {p.careerVsTonight.games}
                </div>
              </div>
              <div>
                <div style={{fontSize:9,color:MUTED}}>Avg Yds</div>
                <div style={{fontSize:14,fontWeight:800,
                  color:p.careerVsTonight.avgYds>=70?POS_C:NEG_C,
                  fontFamily:"'IBM Plex Mono',monospace"}}>
                  {p.careerVsTonight.avgYds}
                </div>
              </div>
              {isQB && (
                <div>
                  <div style={{fontSize:9,color:MUTED}}>Avg TDs</div>
                  <div style={{fontSize:14,fontWeight:800,color:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.careerVsTonight.avgTds}
                  </div>
                </div>
              )}
              {isQB && (
                <div>
                  <div style={{fontSize:9,color:MUTED}}>Avg INTs</div>
                  <div style={{fontSize:14,fontWeight:800,
                    color:p.careerVsTonight.avgInts>=1.5?NEG_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.careerVsTonight.avgInts}
                  </div>
                </div>
              )}
              {isRB && (
                <div>
                  <div style={{fontSize:9,color:MUTED}}>YPC</div>
                  <div style={{fontSize:14,fontWeight:800,
                    color:p.careerVsTonight.ypc>=4.5?POS_C:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.careerVsTonight.ypc}
                  </div>
                </div>
              )}
              {isTE && (
                <div>
                  <div style={{fontSize:9,color:MUTED}}>Avg Rec</div>
                  <div style={{fontSize:14,fontWeight:800,
                    color:p.careerVsTonight.avgRec>=6?POS_C:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>
                    {p.careerVsTonight.avgRec}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{display:"grid",
            gridTemplateColumns:isQB?"44px 56px 44px 28px 28px":"44px 56px 44px 28px 36px",
            padding:"6px 12px",background:CARD3,
            borderBottom:"1px solid "+BORDER}}>
            {isQB && ["DATE","SEASON","YDS","TD","INT"].map(function(h){
              return (<div key={h} style={{fontSize:8,fontWeight:700,
                color:MUTED,textAlign:"center"}}>{h}</div>);
            })}
            {isRB && ["DATE","SEASON","YDS","TD","YPC"].map(function(h){
              return (<div key={h} style={{fontSize:8,fontWeight:700,
                color:MUTED,textAlign:"center"}}>{h}</div>);
            })}
            {isTE && ["DATE","SEASON","YDS","TD","REC"].map(function(h){
              return (<div key={h} style={{fontSize:8,fontWeight:700,
                color:MUTED,textAlign:"center"}}>{h}</div>);
            })}
          </div>
          {p.careerVsTonight.log.map(function(g, i) {
            var rc = g.result==="W"?POS_C:NEG_C;
            return (
              <div key={i} style={{display:"grid",
                gridTemplateColumns:isQB?"44px 56px 44px 28px 28px":"44px 56px 44px 28px 36px",
                padding:"9px 12px",alignItems:"center",
                borderBottom:i<p.careerVsTonight.log.length-1
                  ?"1px solid "+BORDER:"none",
                background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
                <div style={{textAlign:"center",fontSize:9,color:MUTED}}>{g.date}</div>
                <div style={{textAlign:"center",fontSize:9,color:MUTED}}>{g.season}</div>
                <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                  color:g.yds>=70?POS_C:g.yds<40?NEG_C:TEXT2,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{g.yds}</div>
                <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                  color:g.tds>0?POS_C:TEXT2,
                  fontFamily:"'IBM Plex Mono',monospace"}}>{g.tds}</div>
                {isQB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.ints>0?NEG_C:POS_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.ints}</div>
                )}
                {isRB && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.ypc>=4.5?POS_C:NEG_C,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.ypc}</div>
                )}
                {isTE && (
                  <div style={{textAlign:"center",fontSize:11,fontWeight:700,
                    color:g.rec>=5?POS_C:TEXT2,
                    fontFamily:"'IBM Plex Mono',monospace"}}>{g.rec}</div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}


