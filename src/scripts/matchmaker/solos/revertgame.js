const Discord = require("discord.js");

const { EMBED_COLOR_CHECK, EMBED_COLOR_ERROR, finishedGames, assignWinLostOrRevertSolo } = require("../utils");

const execute = async (message) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const [, secondArg, thirdArg] = message.content.split(" ");

  const channelId = message.channel.id;

  if (message.content.split(" ").length === 1 || message.content.split(" ").length === 2) {
    wrongEmbed.setTitle(":x: Invalid Parameters!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (!message.member.hasPermission("ADMINISTRATOR")) {
    wrongEmbed.setTitle(":x: You do not have Administrator permission!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (!finishedGames.map((e) => e.gameId).includes(Number(secondArg))) {
    wrongEmbed.setTitle(":x: No game with that Id has been played");

    message.channel.send(wrongEmbed);
    return;
  }

  const selectedGame = finishedGames.find((e) => e.gameId === Number(secondArg));

  if (selectedGame.channelId !== channelId) {
    wrongEmbed.setTitle(":x: That game hasn't been played in this channel");

    message.channel.send(wrongEmbed);
    return;
  }

  if (thirdArg === "revert" || thirdArg === "cancel") {
    await assignWinLostOrRevertSolo(selectedGame, thirdArg);
  } else {
    wrongEmbed.setTitle(":x: Invalid Parameters!");

    message.channel.send(wrongEmbed);
    return;
  }

  const indexSelectedGame = finishedGames.indexOf(selectedGame);

  finishedGames.splice(indexSelectedGame, 1);

  correctEmbed.setTitle(`:white_check_mark: Game ${thirdArg === "revert" ? "reverted" : "cancelled"}!`);

  message.channel.send(correctEmbed);
};

module.exports = {
  name: "revertgame",
  description: "6man bot",
  execute,
};
