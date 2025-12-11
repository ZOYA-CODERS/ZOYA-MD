const axios = require('axios');

module.exports = {
    command: 'song',
    description: 'Download songs from YouTube',
    category: 'download',
    execute: async (sock, m, {
        args,
        text,
        q,
        quoted,
        mime,
        qmsg,
        isMedia,
        groupMetadata,
        groupName,
        participants,
        groupOwner,
        groupAdmins,
        isBotAdmins,
        isAdmins,
        isGroupOwner,
        isCreator,
        prefix,
        reply,
        config
    }) => {
        try {
            // Check if user provided a search query
            if (!text || text.trim() === '') {
                await sock.sendMessage(m.chat, { 
                    react: { text: "❌", key: m.key } 
                });
                return await reply(`❌ Please provide a song name!\n\nUsage: ${prefix}song <song name>\nExample: ${prefix}song Despacito`);
            }

            // Send searching reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "🎵", key: m.key } 
            });

            // Send initial loading message
            await reply('🔍 Searching for your song...');

            // Make API request to get song data
            const apiUrl = `https://api-site-chi.vercel.app/api/ytmp3?query=${encodeURIComponent(text)}`;
            const response = await axios.get(apiUrl, {
                timeout: 60000 // 60 second timeout
            });

            // Check if API returned valid data
            if (!response.data || response.data.error) {
                throw new Error(response.data?.error || 'Failed to fetch song data');
            }

            const songData = response.data;

            // Validate required fields
            if (!songData.title || !songData.downloadUrl) {
                throw new Error('Invalid response from API - missing required fields');
            }

            // Format song details message
            const detailsMessage = 
`🎵 *SONG FOUND*

📌 *Title:* ${songData.title || 'Unknown'}
⏱️ *Duration:* ${songData.duration || 'Unknown'}
👤 *Channel:* ${songData.channel || 'Unknown'}
🔗 *Source:* ${songData.url || 'YouTube'}

⏳ Downloading audio file...`;

            // Send song details with thumbnail
            if (songData.thumbnail) {
                await sock.sendMessage(m.chat, {
                    image: { url: songData.thumbnail },
                    caption: detailsMessage,
                    contextInfo: {
                        externalAdReply: {
                            title: songData.title || 'Song Download',
                            body: `Duration: ${songData.duration || 'Unknown'} | Channel: ${songData.channel || 'Unknown'}`,
                            thumbnailUrl: songData.thumbnail,
                            sourceUrl: songData.url || '',
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted: m });
            } else {
                await reply(detailsMessage);
            }

            // Download the audio file
            const audioResponse = await axios.get(songData.downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 120000, // 2 minute timeout for download
                maxContentLength: 100 * 1024 * 1024, // 100MB max
                maxBodyLength: 100 * 1024 * 1024
            });

            // Send the audio file
            await sock.sendMessage(m.chat, {
                audio: Buffer.from(audioResponse.data),
                mimetype: 'audio/mpeg',
                fileName: `${songData.title || 'song'}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: songData.title || 'Song',
                        body: songData.channel || 'Music',
                        thumbnailUrl: songData.thumbnail || '',
                        sourceUrl: songData.url || '',
                        mediaType: 1
                    }
                }
            }, { quoted: m });

            // Success reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "✅", key: m.key } 
            });

        } catch (error) {
            console.error('Error in song command:', error);
            
            // Error reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "❌", key: m.key } 
            });

            // Send user-friendly error message
            let errorMessage = '❌ Failed to download the song.\n\n';
            
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage += '⏱️ Request timed out. The song might be too large or the server is slow. Please try again.';
            } else if (error.response?.status === 404) {
                errorMessage += '🔍 Song not found. Please try a different search query.';
            } else if (error.response?.status >= 500) {
                errorMessage += '🔧 Server error. Please try again later.';
            } else if (error.message.includes('Invalid response')) {
                errorMessage += '📭 No results found for your search. Try different keywords.';
            } else {
                errorMessage += `💭 Error: ${error.message || 'Unknown error occurred'}`;
            }

            await reply(errorMessage);
        }
    }
};
