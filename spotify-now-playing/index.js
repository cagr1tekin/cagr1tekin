
const axios = require("axios");
const fs = require("fs");

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || "cagr1tekin/cagr1tekin";

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  const response = await axios.post("https://accounts.spotify.com/api/token", params, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data.access_token;
}

async function getCurrentlyPlaying(accessToken) {
  const response = await axios.get("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  return response.data;
}

async function updateReadme(content) {
  const readme = fs.readFileSync("README.md", "utf-8");
  const updated = readme.replace(/🎧 Now Playing: .*/, `🎧 Now Playing: ${content}`);
  fs.writeFileSync("README.md", updated);

  await axios({
    method: "put",
    url: `https://api.github.com/repos/${repo}/contents/README.md`,
    headers: {
      Authorization: "Bearer " + githubToken,
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      message: "Update Spotify Now Playing",
      content: Buffer.from(updated).toString("base64"),
      sha: await getSha(),
    }),
  });
}

async function getSha() {
  const response = await axios({
    method: "get",
    url: `https://api.github.com/repos/${repo}/contents/README.md`,
    headers: {
      Authorization: "Bearer " + githubToken,
    },
  });
  return response.data.sha;
}

(async () => {
  try {
    const accessToken = await getAccessToken();
    const current = await getCurrentlyPlaying(accessToken);

    if (!current || !current.is_playing) {
      console.log("Nothing is playing.");
      return;
    }

    const song = current.item;
    const content = `${song.name} - ${song.artists.map(a => a.name).join(", ")}`;
    console.log("🎧 Now Playing:", content);
  } catch (err) {
    console.error(err);
  }
})();
