const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'weather',
    description: 'Get weather information for a city',
    options: [
      {
        name: 'city',
        type: 3,
        description: 'City name',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const city = interaction.options.getString('city');
      const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);

      if (!response.ok) {
        await interaction.editReply({ content: '❌ City not found!' });
        return;
      }

      const data = await response.json();

      if (!data.current_condition || data.current_condition.length === 0) {
        await interaction.editReply({ content: '❌ Weather data not available for this city!' });
        return;
      }

      const current = data.current_condition[0];
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`🌤️ Weather in ${city}`)
        .addFields(
          { name: 'Temperature', value: `${current.temp_C}°C / ${current.temp_F}°F`, inline: true },
          { name: 'Feels Like', value: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`, inline: true },
          { name: 'Condition', value: current.weatherDesc[0].value, inline: true },
          { name: 'Humidity', value: `${current.humidity}%`, inline: true },
          { name: 'Wind', value: `${current.windspeedKmph} km/h`, inline: true },
          { name: 'Precipitation', value: `${current.precipMM} mm`, inline: true }
        )
        .setTimestamp();

      const iconUrl =
        current.weatherIconUrl &&
          current.weatherIconUrl[0] &&
          current.weatherIconUrl[0].value &&
          current.weatherIconUrl[0].value.trim() !== ""
          ? current.weatherIconUrl[0].value
          : null;

      if (iconUrl) {
        embed.setThumbnail(iconUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Weather error:', error);
      await interaction.editReply({ content: '❌ Failed to fetch weather data! Please try another city.' });
    }
  }
};
