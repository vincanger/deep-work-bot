import { Client, Message } from 'discord.js';
import config from './config';
import {helpCommand, deepWorkCommand, deepWorkTimeLeft, deepWorkWorkingNow, deepWorkURL} from './commands';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

const { intents, prefix, token } = config;

const client = new Client({
  intents,
  presence: {
    status: 'online',
    activities: [{
      name: `${prefix}help`,
      type: 'LISTENING'
    }]
  }
});

client.on('ready', () => {
  console.log(`Logged in as: ${client.user?.tag}`);
  console.log(`process: ${process.env}`);
});

client.on("presenceUpdate", async (_, newPresence) => {
  // if (newPresence?.member?.roles.cache.has("1050366058785148999")) {
    // TODO: change ID for correct server role // for testing : "1050366058785148999"
    if (newPresence?.member?.roles.cache.has(process.env.ROLE_ID!)) { // TODO: change ID for correct server role // for testing : "1050366058785148999"

    if (newPresence.status === 'dnd') {
      // const channel = await client.channels.fetch("1059770183016783962"); // TODO: change id for correct server channel // for testing: '1059770183016783962'
      const channel = await client.channels.fetch(process.env.CHANNEL_ID!); // TODO: change id for correct server channel // for testing: '1059770183016783962'
      if (channel?.type === 'GUILD_TEXT') {
        // Send a message to the text channel
        await channel.send(`Hi ${newPresence.member} 🧘 Would you like to log Deep Work time (y/n)?`);
        const filter = (m: Message) => m.member === newPresence.member && m.content.toLowerCase() === 'y';
        const collector = channel.createMessageCollector({ filter, time: 30000 });

        collector.on('collect', async (m) => {
          await deepWorkCommand(m);
          collector.stop();
        });
        collector.on('end', async (_, reason) => {
          if (reason === 'time') {
            await channel.send(
              `⌛️ You took too long to respond. Type '!deepwork' if you still want to log a session.`
            );
          }
        });
      }
    }
  }
});


client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).split(' ');
    const command = args.shift();

    switch(command) {
      case 'help':
        const embed = helpCommand(message);
        embed.setThumbnail(client.user!.displayAvatarURL());
        await message.channel.send({ embeds: [embed] });
        break;

      case 'deepwork':
        await deepWorkCommand(message)
        break;

      case 'timeleft':
        await deepWorkTimeLeft(message);
        break;

      case 'whois':
        await deepWorkWorkingNow(message);
        break;

      case 'url':
        await deepWorkURL(message);
        break;
    }
  }
});

client.login(token);
