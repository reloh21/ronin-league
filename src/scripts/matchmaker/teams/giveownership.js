const Discord = require("discord.js");

const TeamsCollection = require("../../../utils/schemas/matchmakerTeamsSchema");

const { sendMessage } = require("../../../utils/utils");

const {
  EMBED_COLOR_CHECK,
  EMBED_COLOR_ERROR,
  fetchTeamByGuildAndUserId,
  getQueueArray,
  fetchGamesTeams,
} = require("../utils");

const execute = async (message, queueSize) => {
  const wrongEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_ERROR);

  const correctEmbed = new Discord.MessageEmbed().setColor(EMBED_COLOR_CHECK);

  const fetchedTeam = await fetchTeamByGuildAndUserId(message.guild.id, message.author.id);

  if (fetchedTeam == null) {
    wrongEmbed.setTitle(":x: You do not belong to a team!");

    sendMessage(message, wrongEmbed);
    return;
  }

  if (message.mentions.members.first() == null) {
    wrongEmbed.setTitle(":x: Please tag the user");

    sendMessage(message, wrongEmbed);
    return;
  }

  const pingedUser = message.mentions.members.first().user.id;

  const queueArray = getQueueArray(queueSize, message.channel.id, message.guild.id, "teams");

  if (queueArray[0]?.name === fetchedTeam.name) {
    wrongEmbed.setTitle(":x: Please leave the queue first!");

    sendMessage(message, wrongEmbed);
    return;
  }

  const ongoingGames = await fetchGamesTeams(null, message.guild.id);

  if (
    ongoingGames
      .map((e) => [e.team1, e.team2])
      .flat()
      .map((e) => e.name)
      .includes(fetchedTeam.name)
  ) {
    wrongEmbed.setTitle(":x: You are in the middle of a game!");

    sendMessage(message, wrongEmbed);
    return;
  }

  if (fetchedTeam.captain !== message.author.id) {
    wrongEmbed.setTitle(":x: You are not the captain!");

    sendMessage(message, wrongEmbed);
    return;
  }

  if (!fetchedTeam.members.includes(pingedUser)) {
    wrongEmbed.setTitle(":x: User does not belong to your team!");

    sendMessage(message, wrongEmbed);
    return;
  }

  fetchedTeam.members.push(message.author.id);

  fetchedTeam.members.splice(fetchedTeam.members.indexOf(pingedUser), 1);

  correctEmbed.setTitle(`:white_check_mark: Given ownership to ${message.mentions.members.first().user.username}`);

  await TeamsCollection.updateOne(
    {
      guildId: message.guild.id,
      name: fetchedTeam.name,
    },
    {
      captain: pingedUser,
      members: fetchedTeam.members,
    }
  );

  sendMessage(message, correctEmbed);
};

module.exports = {
  name: "giveownership",
  description: "Gives team ownership to a specific user. Usage: !giveownership @dany or !giveownership",
  execute,
};
