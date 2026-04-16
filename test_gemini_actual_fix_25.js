
const GEMINI_API_KEY = "AIzaSyC4oVB4UbIJ2xmRSMgu5k0Tqtl6OWAQpVE";
const model = "gemini-2.5-flash";

async function testGeminiActualFix25() {
  const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Search for today's cybersecurity news." }]
        }],
        tools: [{
          google_search: {}
        }]
      })
    });

    const resJson = await aiRes.json();
    console.log(JSON.stringify(resJson, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testGeminiActualFix25();
