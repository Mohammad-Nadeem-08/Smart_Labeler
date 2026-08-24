require("dotenv").config();

const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function listModels() {
  try {
    const models = await groq.models.list();

    console.log("\nAvailable models:\n");

    models.data.forEach((model) => {
      console.log(model.id);
    });
  } catch (error) {
    console.error("Error getting models:", error);
  }
}

listModels();