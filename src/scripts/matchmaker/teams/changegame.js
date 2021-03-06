const Discord = require("discord.js");

const { EMBED_COLOR_CHECK, EMBED_COLOR_ERROR, getContent } = require("../../../utils/utils");

const MatchmakerTeamsScoreCollection = require("../../../utils/schemas/matchmakerTeamsScoreSchema");

const { redisInstance } = require("../../../utils/createRedisInstance.js");

const changeGame = async (game, param) => {
  const promises = [];

  [game.team1, game.team2].forEach(async (team) => {
    const won =
      (game.winningTeam === 0 && game.team1.name === team.name) ||
      (game.winningTeam === 1 && game.team2.name === team.name);

    let mmrAddition;

    switch (param) {
      case "revert":
        mmrAddition = won ? -game.mmrDifference * 2 : game.mmrDifference * 2;
        break;
      case "cancel":
        mmrAddition = won ? -game.mmrDifference : game.mmrDifference;
        break;
      default:
        break;
    }

    promises.push(
      await MatchmakerTeamsScoreCollection.updateOne(
        {
          channelId: game.channelId,
          name: team.name,
        },
        {
          $inc: {
            [won ? "wins" : "losses"]: -1,
            [!won ? "wins" : "losses"]: param === "revert" ? 1 : 0,
            mmr: mmrAddition,
          },
        }
      )
    );
  });
  await Promise.all(promises);
};

const { sendReply } = require("../../../utils/utils");

const execute = async (interaction) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const [secondArg, thirdArg] = getContent(interaction);

  const channelId = interaction.channel.id;

  if (!["revert", "cancel"].includes(thirdArg)) {
    wrongEmbed.setTitle(":x: Invalid Parameters!");

    await sendReply(interaction, wrongEmbed);
    return;
  }

  if (!interaction.member.permissions.has("ADMINISTRATOR")) {
    wrongEmbed.setTitle(":x: You do not have Administrator permission!");

    await sendReply(interaction, wrongEmbed);
    return;
  }

  const finishedGames = await redisInstance.getObject("finishedGames");

  if (!finishedGames.map((e) => e.gameId).includes(Number(secondArg))) {
    wrongEmbed.setTitle(":x: No game with that Id has been played");

    await sendReply(interaction, wrongEmbed);
    return;
  }

  const selectedGame = finishedGames.find((e) => e.gameId === Number(secondArg));

  if (selectedGame.channelId !== channelId) {
    wrongEmbed.setTitle(":x: That game hasn't been played in this channel");

    await sendReply(interaction, wrongEmbed);
    return;
  }

  await changeGame(selectedGame, thirdArg);

  const indexSelectedGame = finishedGames.indexOf(selectedGame);

  finishedGames.splice(indexSelectedGame, 1);

  await redisInstance.setObject("finishedGames", finishedGames);

  correctEmbed.setTitle(`:white_check_mark: Game ${thirdArg === "revert" ? "reverted" : "cancelled"}!`);

  await sendReply(interaction, correctEmbed);
};

module.exports = {
  name: "changegame",
  description: "Cancels/reverts score of a finished game",
  helpDescription:
    "Cancels/reverts score of a finished game. Usage: /changegame (gameid) cancel, this example will cancel the game, as it never happen. /changegame (gameid) revert, this example will revert the scores",
  args: [
    { name: "gameid", description: "gameid", required: true, type: "string" },
    { name: "changegame_type", description: "type of command, revert or cancel", required: true, type: "string" },
  ],
  execute,
};
