import ytdl from "ytdl-core";

export const processController = async (req, res) => {
  try {
    const url = req.query.url;
    if (!ytdl.validateURL(url)) {
      return res.status(400).send('Invalid URL');
    }

    try {
      const info = await ytdl.getBasicInfo(url);
      const title = info.videoDetails.title.replace(/[^\x00-\x7F]/g, "");
      const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "_");

      res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
      const audioStream = ytdl(url, { format: 'mp3', filter: 'audioonly' });
      audioStream.pipe(res);

      audioStream.on('error', error => {
        console.error('Streaming error:', error);
        res.status(500).send('Failed to stream the audio');
      });

    } catch (error) {
      console.error('Error fetching video info:', error);
      res.status(500).send('Error processing video information');
    }
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Server error'); 
  }
}