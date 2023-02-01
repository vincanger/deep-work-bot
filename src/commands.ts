import { Message, MessageEmbed, MessageCollector } from 'discord.js';
import config from './config';
// const Database = require('@replit/database')
// const db = new Database();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient()

const { prefix } = config;

type Command = {
  description: string;
  format: string;
  aliases?: string[];
}


const commands: { [name: string]: Command } = {
  'help': {
    description: 'Shows the list of commands and their details.',
    format: 'help'
  },
  'deepwork': {
    description: 'Log a Deep Work session',
    format: 'deepwork'
  },
  'whois': {
    description: 'Who is in Deep Work mode',
    format: 'whois'
  },
  'timeleft': {
    description: 'Time Left in your session',
    format: 'timeleft'
  },
  'url': {
    description: 'The Deep Work Dashboard',
    format: 'url'
  },
}

interface session {
  username: string;
  timeStarted: number;
  minutes: string;
}

const db: Map<string, string> = new Map();

export async function deepWorkCommand(message: Message) {
  await deepWorkWhoIs(message);
  const isUserValid: boolean = await checkValidUser(message);
  if (!isUserValid) {
    await message.channel.send(`🪧 Please register with the tracking app first before trying to log hours -- ${process.env.APP_URL} `);
    return;
  }
  // Send a message asking the user for input
  await message.channel.send('⏳ How Long would you like your session to be (in minutes)?:');

  // Create a message collector to listen for the user's response
  const collector = new MessageCollector(message.channel, {filter: m => m.author.id === message.author.id, time: 10000 });

  // Wait for the user's response
  collector.on('collect', async (userMessage: Message) => {
    // Act on the user's input
    await message.channel.send(`Nice 🧙‍♂️! You want to work for: "${userMessage.content} minutes" \n\n Consider turning off other app notifications and distractions`);
    const currentSession = db.get(message.author.id)
    console.log('current session', currentSession);
    if (currentSession) db.delete(message.author.id);
    const minutesInMilliseconds = Number(userMessage.content) * 60 * 1000;
    const sessionObj: session = {
      username: message.author.username,
      timeStarted: Date.now(),
      minutes: userMessage.content,
    }

    const session = db.set(message.author.id, JSON.stringify(sessionObj) );

    console.log('session set', session)

    setTimeout(async () => {
      // Send a message to the user to let them know the session is over
      await message.channel.send(`I'm proud of you ${message.author.username}! 🧙‍♂️ You DeepWorked for ${userMessage.content} minutes.`);
      db.delete(message.author.id);
      await prisma.work.create({
        data: {
          username: message.author.username,
          minutes: userMessage.content,
          timeStarted: new Date().toISOString(),
          user: { connect: { userId: message.author.id } }
        }
      })
    }, minutesInMilliseconds);
    
    collector.stop();
  });

  // If the user doesn't respond within 10 seconds, send a message and stop the collector
  collector.on('end', async (_, reason: string) => {
    if (reason === 'time') {
      await message.channel.send('You took too long to respond.');
    }
  });
}

export async function deepWorkWhoIs(message: Message) {
  // return all sessions
  // const sessionsArr = Array<session>();
  const sessions = db.entries()

  console.log('sessions: ', sessions)
  // if (sessions) {
  //   console.log(Object.entries(sessions))
  //   for (const [userId, data] of Object.entries(sessions)) {

  //     try {
  //       // use the data object
  //       const sessionObj = {
  //         userId: userId,
  //         username: data.username,
  //         timeStarted: data.timeStarted,
  //         minutes: data.minutes,
  //       }
  //       sessionsArr.push(sessionObj)
  //     } catch (error) {
  //       console.error(error);
  //     }
  //   }

  //   console.log('sessions array: ' ,sessionsArr)
  // } else {
  //   console.log('no sessions')
  // }

  let timeLeft= 'no session';
  if (sessions) {
    db.forEach((sess, key) => {
      const session = JSON.parse(sess);
      if (message.author.id === key) {
        
        timeLeft = (Number(session.minutes) - (Date.now() - session.timeStarted) / 1000 / 60).toString();
      } 
    })
  }
  console.log('time left: ', timeLeft)
  return timeLeft;
}

export async function deepWorkTimeLeft(message: Message) {
  try {
    const timeLeft = await deepWorkWhoIs(message);
    await message.channel.send(`${timeLeft} minutes left to DeepWork.`);
  } catch (err) {
    console.error(err);
  }
}

async function checkValidUser(message: Message) {
  const user = await prisma.user.findUnique({
    where: {
      username: message.author.username,
    },
  })

  if (!user) return false
  
  if (!user.userId) {
    await prisma.user.update({
      where: {
        username: message.author.username,
      },
      data: {
        userId: message.author.id,
      },
    })
  }
  return true
}

export async function deepWorkWorkingNow(message: Message) {
  let sessionsArr = Array<string>();
  db.forEach((sess) => {
    console.log('sess: ', sess)
    const session = JSON.parse(sess)
    sessionsArr.push(session.username)
    console.log('sessionsArr: ', sessionsArr)
  })
  await message.channel.send(`Current Deep Workers: ${sessionsArr ? `💭 ${sessionsArr.join(',')}` : '🧹 nobody'}`);
}

export async function deepWorkURL(message: Message) {
  await message.channel.send(`${process.env.APP_URL}`)
}
    
export function helpCommand(message: Message) {
  const footerText = message.author.tag;
  const footerIcon = message.author.displayAvatarURL();
  const embed = new MessageEmbed()
    .setTitle('HELP MENU')
    .setColor('GREEN')
    .setFooter({ text: footerText, iconURL: footerIcon });

  for (const commandName of Object.keys(commands)) {
    const command = commands[commandName];
    let desc = command.description + '\n\n';
    if (command.aliases) desc += `**Aliases :** ${command.aliases.join(', ')}\n\n`;
    desc += '**Format**\n```\n' + prefix + command.format + '```';

    embed.addField(commandName, desc, false);
  }

  return embed;
}