const Discord = require("discord.js");

const { EMBED_COLOR_CHECK, EMBED_COLOR_ERROR, sendReply, getContent } = require("../../../utils/utils");

const { redisInstance } = require("../../../utils/createRedisInstance");

const MatchmakerTeamsCollection = require("../../../utils/schemas/matchmakerTeamsSchema");

const MatchmakerTeamsScoreCollection = require("../../../utils/schemas/matchmakerTeamsScoreSchema");

const OngoingGames = require("../../../utils/schemas/ongoingGamesTeamsSchema");

const disbandTeam = async (interaction, fetchedTeam) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const teamName = getContent(interaction).join("");

  if (!fetchedTeam) {
    wrongEmbed.setTitle(`:x: ${teamName !== "" ? "Team not found" : "You are not the captain of a team!"}`);

    await sendReply(interaction, wrongEmbed);
    return;
  }

  const foundGame = await OngoingGames.findOne({
    guildId: interaction.channel.id,
    $or: [
      {
        "team1.name": fetchedTeam.name,
      },
      {
        "team2.name": fetchedTeam.name,
      },
    ],
  });

  if (foundGame != null) {
    wrongEmbed.setTitle(":x: Team is in the middle of a game!");

    await sendReply(interaction, wrongEmbed);

    return;
  }

  const channelQueues = await redisInstance.getObject("channelQueues");

  const channels = channelQueues.filter((e) => e.guildId === interaction.guild.id);

  const inQueue = channels.find((e) => e.players[0]?.name === fetchedTeam.name);

  if (inQueue != null) {
    inQueue.players.splice(0, inQueue.players.length);

    wrongEmbed.setTitle(`:x: ${fetchedTeam.name} was kicked from the queue since they were disbanded`);

    await sendReply(interaction, wrongEmbed);
  }

  await MatchmakerTeamsCollection.deleteOne({
    guildId: interaction.guild.id,
    name: fetchedTeam.name,
  });

  await MatchmakerTeamsScoreCollection.deleteOne({
    guildId: interaction.guild.id,
    name: fetchedTeam.name,
  });

  const invites = await redisInstance.getObject("invites");

  if (invites[fetchedTeam.name] != null) {
    invites[fetchedTeam.name].splice(0, invites[fetchedTeam.name].length);

    await redisInstance.setObject("invites", invites);
  }

  correctEmbed.setTitle(`:white_check_mark: ${fetchedTeam.name} Deleted!`);

  await sendReply(interaction, correctEmbed);
};

const execute = async (interaction) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const teamName = getContent(interaction).join("");

  if (teamName !== "") {
    if (!interaction.member.permissions.has("ADMINISTRATOR")) {
      wrongEmbed.setTitle(":x: You do not have administrator permission to delete said team");

      await sendReply(interaction, wrongEmbed);
      return;
    }
    const fetchedTeam = await MatchmakerTeamsCollection.findOne({
      guildId: interaction.guild.id,
      name: teamName,
    });

    disbandTeam(interaction, fetchedTeam);

    return;
  }

  const fetchedTeam = await MatchmakerTeamsCollection.findOne({
    captain: interaction.member.id,
    guildId: interaction.guild.id,
  });

  disbandTeam(interaction, fetchedTeam);
};

module.exports = {
  name: "disband",
  description: "Deletes your team, admins can also delete a team by typing /disband teamname",
  args: [{ name: "teamname", description: "Team Name", required: false, type: "string" }],
  execute,
};
