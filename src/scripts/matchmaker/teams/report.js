const Discord = require("discord.js");

const OngoingGamesTeamsCollection = require("../../../utils/schemas/ongoingGamesSolosSchema.js");

const {
  EMBED_COLOR_CHECK,
  EMBED_COLOR_ERROR,
  includesUserId,
  joinTeam1And2,
  fetchGamesTeams,
  finishedGames,
  messageEndswith,
  deletableChannels,
  assignWinLostOrRevertTeams,
  fetchTeamByGuildAndUserId,
} = require("../utils");

const execute = async (message) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const userId = message.author.id;

  const channelId = message.channel.id;

  const storedGames = await fetchGamesTeams(message.channel.id);

  const fetchedTeam = await fetchTeamByGuildAndUserId(message.guild.id, message.author.id);

  if (fetchedTeam == null) {
    wrongEmbed.setTitle(":x: You do not belong to a team!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (fetchedTeam.captain !== userId) {
    wrongEmbed.setTitle(":x: You are not the captain!");

    message.channel.send(wrongEmbed);
    return;
  }
  if (
    !storedGames
      .map((e) => joinTeam1And2(e))
      .flat()
      .map((e) => e.captain)
      .includes(userId)
  ) {
    wrongEmbed.setTitle(":x: You aren't in a game!");

    message.channel.send(wrongEmbed);
    return;
  }
  const game = storedGames.find((e) => includesUserId(joinTeam1And2(e), userId));

  if (game.channelId !== channelId) {
    wrongEmbed.setTitle(":x: This is not the correct channel to report the win/lose!");

    message.channel.send(wrongEmbed);
    return;
  }

  if (messageEndswith(message) !== "win" && messageEndswith(message) !== "lose") {
    wrongEmbed.setTitle(":x: Invalid params, please use !report (win or lose)");

    message.channel.send(wrongEmbed);
    return;
  }
  if (
    (game.team1.captain && messageEndswith(message) === "win") ||
    (game.team2.captain && messageEndswith(message) === "lose")
  ) {
    game.winningTeam = 0;
  } else {
    game.winningTeam = 1;
  }

  const typeFunc = "Finished";

  await assignWinLostOrRevertTeams(game, typeFunc);

  finishedGames.push(game);

  await OngoingGamesTeamsCollection.deleteOne({
    gameId: game.gameId,
  });

  game.voiceChannelIds.forEach((channel) => {
    deletableChannels.push(channel);
  });

  correctEmbed.setTitle(":white_check_mark: Game Completed! Thank you for Playing!");

  message.channel.send(correctEmbed);
};

module.exports = {
  name: "report",
  description: "6man bot",
  execute,
};
