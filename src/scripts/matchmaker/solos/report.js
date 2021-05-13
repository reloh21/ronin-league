const Discord = require("discord.js");

const OngoingGamesCollection = require("../../../utils/schemas/ongoingGamesSchema.js");

const {
  EMBED_COLOR_CHECK,
  EMBED_COLOR_ERROR,
  includesUserId,
  joinTeam1And2,
  fetchGames,
  finishedGames,
  messageEndswith,
  deletableChannels,
  assignWinLostOrRevert,
} = require("../utils");

const execute = async (message, queueSize) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const userId = message.author.id;

  const channelID = message.channel.id;

  const storedGames = await fetchGames(Number(queueSize));

  if (!includesUserId(storedGames.map((e) => joinTeam1And2(e)).flat(), userId)) {
    wrongEmbed.setTitle(":x: You aren't in a game!");

    return message.channel.send(wrongEmbed);
  }
  const games = storedGames.find((game) => includesUserId(joinTeam1And2(game), userId));

  if (games.channelID !== channelID) {
    wrongEmbed.setTitle(":x: This is not the correct channel to report the win/lose!");

    return message.channel.send(wrongEmbed);
  }

  games.winningTeam = games.team1.map((e) => e.id).includes(userId) && messageEndswith(message) === "win" ? 1 : 2;

  const typeFunc = "Finished";

  await assignWinLostOrRevert(games, typeFunc);

  finishedGames.push(games);

  await OngoingGamesCollection.deleteOne({
    queueSize: Number(queueSize),
    gameID: games.gameID,
  });

  games.voiceChannelIds.forEach((channel) => {
    deletableChannels.push(channel);
  });

  correctEmbed.setTitle(":white_check_mark: Game Completed! Thank you for Playing!");

  return message.channel.send(correctEmbed);
};

module.exports = {
  name: "report",
  description: "6man bot",
  execute,
};
