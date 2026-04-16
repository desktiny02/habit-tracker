
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const model = "gemini-2.5-flash";

async function testGemini() {
  const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = "SEARCH the internet for the 3-5 most significant cybersecurity news stories from the last 24 hours.";
  
  try {
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
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

testGemini();
