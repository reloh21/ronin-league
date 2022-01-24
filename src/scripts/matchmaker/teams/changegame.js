const Discord = require("discord.js");

const { EMBED_COLOR_CHECK, EMBED_COLOR_ERROR, finishedGames } = require("../../../utils/utils");

const MatchmakerTeamsScoreSchema = require("../../../utils/schemas/matchmakerTeamsScoreSchema");

const changeGame = async (game, param) => {
  const promises = [];

  [...game.team1, ...game.team2].forEach(async (team) => {
    const won =
      (game.winningTeam === 0 && (game.team1.memberIds.includes(team.userId) || game.team1.captain === team.userId)) ||
      (game.winningTeam === 1 && (game.team2.memberIds.includes(team.userId) || game.team2.captain === team.userId));

    promises.push(
      await MatchmakerTeamsScoreSchema.updateOne(
        {
          channelId: game.channelId,
          name: team.name,
        },
        {
          $inc: {
            [won ? "wins" : "losses"]: -1,
            [!won ? "wins" : "losses"]: param === "revert" ? 1 : 0,
            // eslint-disable-next-line no-nested-ternary
            mmr: team.mmr + (param === "revert" ? (!won ? game.mmrDifference * 2 : -game.mmrDifference * 2) : 0),
          },
        }
      )
    );
  });
  await Promise.all(promises);
};

const { sendMessage } = require("../../../utils/utils");

const execute = async (message) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const [, secondArg, thirdArg] = message.content.split(" ");

  const channelId = message.channel.id;

  if (thirdArg === "revert" || thirdArg === "cancel") {
    wrongEmbed.setTitle(":x: Invalid Parameters!");

    sendMessage(message, wrongEmbed);
    return;
  }

  if (!message.member.hasPermission("ADMINISTRATOR")) {
    wrongEmbed.setTitle(":x: You do not have Administrator permission!");

    sendMessage(message, wrongEmbed);
    return;
  }

  if (!finishedGames.map((e) => e.gameId).includes(Number(secondArg))) {
    wrongEmbed.setTitle(":x: No game with that Id has been played");

    sendMessage(message, wrongEmbed);
    return;
  }

  const selectedGame = finishedGames.find((e) => e.gameId === Number(secondArg));

  if (selectedGame.channelId !== channelId) {
    wrongEmbed.setTitle(":x: That game hasn't been played in this channel");

    sendMessage(message, wrongEmbed);
    return;
  }

  await changeGame(selectedGame, thirdArg);

  const indexSelectedGame = finishedGames.indexOf(selectedGame);

  finishedGames.splice(indexSelectedGame, 1);

  correctEmbed.setTitle(`:white_check_mark: Game ${thirdArg === "revert" ? "reverted" : "cancelled"}!`);

  sendMessage(message, correctEmbed);
};

module.exports = {
  name: "changegame",
  description:
    "Cancels/reverts score of a finished game. Usage: !changegame (gameid) cancel, this example will cancel the game, as it never happen. !changegame (gameid) revert, this example will revert the scores (I know this name is shit plz give better options)",
  execute,
};