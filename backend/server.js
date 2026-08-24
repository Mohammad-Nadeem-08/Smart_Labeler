require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// GROQ CONFIGURATION
// ==========================================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});


// ==========================================
// GOOGLE OAUTH CONFIGURATION
// ==========================================

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


// ==========================================
// TEMPORARY TOKEN STORAGE
// ==========================================

// For development only.
// Tokens will be lost when server restarts.

let googleTokens = null;


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Smart Labeler backend is running!"
  });
});


// ==========================================
// GOOGLE LOGIN
// ==========================================

app.get("/auth/google", (req, res) => {

  const authUrl =
    oauth2Client.generateAuthUrl({

      access_type: "offline",

      prompt: "consent",

      scope: [
        "https://www.googleapis.com/auth/gmail.modify"
      ]

    });

  res.redirect(authUrl);

});


// ==========================================
// GOOGLE OAUTH CALLBACK
// ==========================================

app.get(
  "/auth/google/callback",

  async (req, res) => {

    try {

      const { code } = req.query;

      const { tokens } =
        await oauth2Client.getToken(code);


      googleTokens = tokens;


      oauth2Client.setCredentials(
        tokens
      );


      console.log(
        "Google authentication successful!"
      );


      res.send(`
        <h1>
          Smart Labeler Connected Successfully! 🎉
        </h1>

        <p>
          You can close this tab and return to Gmail.
        </p>
      `);

    } catch (error) {

      console.error(
        "Google authentication error:",
        error
      );


      res.status(500).send(
        "Google authentication failed."
      );

    }

  }
);


// ==========================================
// LIST GMAIL LABELS
// ==========================================

app.get(
  "/gmail/labels",

  async (req, res) => {

    try {

      if (!googleTokens) {

        return res.status(401).json({
          success: false,

          error:
            "Please authenticate with Google first."
        });

      }


      oauth2Client.setCredentials(
        googleTokens
      );


      const gmail =
        google.gmail({

          version: "v1",

          auth: oauth2Client

        });


      const response =
        await gmail.users.labels.list({

          userId: "me"

        });


      const labels =
        response.data.labels || [];


      console.log(
        "\n===== GMAIL LABELS ====="
      );


      labels.forEach((label) => {

        console.log(
          `${label.id} → ${label.name}`
        );

      });


      console.log(
        "========================\n"
      );


      res.json({

        success: true,

        labels

      });

    } catch (error) {

      console.error(
        "Error fetching Gmail labels:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          "Failed to fetch Gmail labels."

      });

    }

  }
);


// ==========================================
// AI EMAIL ANALYSIS
// ==========================================

app.post(
  "/analyze",

  async (req, res) => {

    try {

      const {
        subject,
        sender,
        body
      } = req.body;


      if (!subject || !body) {

        return res.status(400).json({

          success: false,

          error:
            "Subject and body are required."

        });

      }


      const prompt = `
You are an intelligent Gmail email classifier.

Analyze the following email and classify it into ONE short label.

You may use an existing common category if appropriate:

Work
Academics
Career
Finance
Shopping
Travel
Social
Promotions
Important
Personal
Updates

If none fit well, create a short meaningful label of 1-3 words.

Also extract the 3 to 8 most important keywords or short phrases
that would help someone understand the email quickly.

Return ONLY valid JSON in exactly this format:

{
  "label": "string",
  "confidence": 0.0,
  "keywords": [
    "keyword1",
    "keyword2",
    "keyword3"
  ]
}

Email details:

Subject: ${subject}

Sender: ${sender}

Body:
${body.substring(0, 6000)}
`;


      const completion =
        await groq.chat.completions.create({

          model:
            "openai/gpt-oss-20b",

          messages: [

            {
              role: "system",

              content:
                "You are a precise email classification assistant. Always return valid JSON only."
            },

            {
              role: "user",

              content: prompt
            }

          ],

          temperature: 0.2,

          response_format: {
            type: "json_object"
          }

        });


      const aiResponse =
        completion
          .choices[0]
          .message
          .content;


      console.log(
        "AI Response:",
        aiResponse
      );


      const analysis =
        JSON.parse(aiResponse);


      res.json({

        success: true,

        label:
          analysis.label,

        confidence:
          analysis.confidence,

        keywords:
          analysis.keywords || []

      });

    } catch (error) {

      console.error(
        "AI analysis error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          "Failed to analyze email."

      });

    }

  }
);


// ==========================================
// APPLY LABEL TO SINGLE EMAIL
// ==========================================

app.post(
  "/gmail/apply-label",

  async (req, res) => {

    try {

      if (!googleTokens) {

        return res.status(401).json({

          success: false,

          error:
            "Please authenticate with Google first."

        });

      }


      const {
        subject,
        sender,
        label,
        autoCreate = true
      } = req.body;


      if (!subject || !sender || !label) {

        return res.status(400).json({

          success: false,

          error:
            "Subject, sender, and label are required."

        });

      }


      oauth2Client.setCredentials(
        googleTokens
      );


      const gmail =
        google.gmail({

          version: "v1",

          auth: oauth2Client

        });


      // ====================================
      // SEARCH FOR EMAIL
      // ====================================

      const searchResponse =
        await gmail.users.messages.list({

          userId: "me",

          q: `subject:"${subject}" from:${sender}`,

          maxResults: 5

        });


      const messages =
        searchResponse.data.messages;


      if (
        !messages ||
        messages.length === 0
      ) {

        return res.status(404).json({

          success: false,

          error:
            "Could not find the email in Gmail."

        });

      }


      const messageId =
        messages[0].id;


      console.log(
        "Matched Gmail message:",
        messageId
      );


      // ====================================
      // GET EXISTING LABELS
      // ====================================

      const labelsResponse =
        await gmail.users.labels.list({

          userId: "me"

        });


      let existingLabel =
        labelsResponse.data.labels.find(

          (item) =>

            item.name.toLowerCase() ===
            label.toLowerCase()

        );


      let labelId;


      // ====================================
      // CREATE OR REUSE LABEL
      // ====================================

      if (!existingLabel) {

        // User disabled automatic creation

        if (!autoCreate) {

          return res.status(400).json({

            success: false,

            error:
              `Label "${label}" does not exist and automatic label creation is disabled.`

          });

        }


        console.log(
          `Creating new label: ${label}`
        );


        const createResponse =
          await gmail.users.labels.create({

            userId: "me",

            requestBody: {

              name: label,

              labelListVisibility:
                "labelShow",

              messageListVisibility:
                "show"

            }

          });


        labelId =
          createResponse.data.id;


        console.log(
          `Label created: ${label} (${labelId})`
        );

      } else {

        labelId =
          existingLabel.id;


        console.log(
          `Using existing label: ${label} (${labelId})`
        );

      }


      // ====================================
      // APPLY LABEL
      // ====================================

      await gmail.users.messages.modify({

        userId: "me",

        id: messageId,

        requestBody: {

          addLabelIds: [
            labelId
          ]

        }

      });


      console.log(
        `Successfully applied "${label}" to message ${messageId}`
      );


      res.json({

        success: true,

        messageId,

        label,

        labelId,

        message:
          `Label "${label}" applied successfully!`

      });

    } catch (error) {

      console.error(
        "Apply label error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          "Failed to apply Gmail label."

      });

    }

  }
);


// ==========================================
// ANALYZE RECENT INBOX EMAILS
// ==========================================

app.post(
  "/gmail/analyze-inbox",

  async (req, res) => {

    try {

      if (!googleTokens) {

        return res.status(401).json({

          success: false,

          error:
            "Please authenticate with Google first."

        });

      }


      // ====================================
      // GET SETTINGS FROM EXTENSION
      // ====================================

      const {

        limit = 5,

        minConfidence = 50,

        autoCreate = true

      } = req.body;


      console.log(
        "\n===== INBOX ANALYSIS STARTED ====="
      );


      console.log(
        "Email Limit:",
        limit
      );


      console.log(
        "Minimum Confidence:",
        minConfidence
      );


      console.log(
        "Auto Create Labels:",
        autoCreate
      );


      oauth2Client.setCredentials(
        googleTokens
      );


      const gmail =
        google.gmail({

          version: "v1",

          auth: oauth2Client

        });


      // ====================================
      // GET RECENT INBOX EMAILS
      // ====================================

      const inboxResponse =
        await gmail.users.messages.list({

          userId: "me",

          labelIds: [
            "INBOX"
          ],

          maxResults:
            Number(limit)

        });


      const messages =
        inboxResponse.data.messages || [];


      if (
        messages.length === 0
      ) {

        return res.json({

          success: true,

          analyzed: 0,

          total: 0,

          results: [],

          summary: {}

        });

      }


      // ====================================
      // GET ALL EXISTING LABELS
      // ====================================

      const labelsResponse =
        await gmail.users.labels.list({

          userId: "me"

        });


      let gmailLabels =
        labelsResponse.data.labels || [];


      const results = [];

      const summary = {};


      // ====================================
      // PROCESS EACH EMAIL
      // ====================================

      for (
        const message of messages
      ) {

        try {

          console.log(
            "\nProcessing message:",
            message.id
          );


          // ================================
          // GET FULL EMAIL
          // ================================

          const messageResponse =
            await gmail.users.messages.get({

              userId: "me",

              id: message.id,

              format: "full"

            });


          const emailMessage =
            messageResponse.data;


          // ================================
          // EXTRACT HEADERS
          // ================================

          const headers =
            emailMessage.payload.headers || [];


          function getHeader(name) {

            const header =
              headers.find(

                (item) =>

                  item.name
                    .toLowerCase() ===
                  name
                    .toLowerCase()

              );


            return header
              ? header.value
              : "";

          }


          const subject =
            getHeader("Subject") ||
            "No Subject";


          const sender =
            getHeader("From") ||
            "Unknown Sender";


          // ================================
          // EXTRACT EMAIL BODY
          // ================================

          function extractBody(payload) {

            if (!payload) {
              return "";
            }


            // Direct text body

            if (
              payload.mimeType ===
                "text/plain" &&
              payload.body &&
              payload.body.data
            ) {

              return Buffer.from(
                payload.body.data,
                "base64"
              ).toString("utf-8");

            }


            // Search child parts

            if (
              payload.parts &&
              payload.parts.length > 0
            ) {

              for (
                const part of payload.parts
              ) {

                const text =
                  extractBody(part);


                if (text) {

                  return text;

                }

              }

            }


            // Fallback

            if (
              payload.body &&
              payload.body.data
            ) {

              return Buffer.from(
                payload.body.data,
                "base64"
              ).toString("utf-8");

            }


            return "";

          }


          const body =
            extractBody(
              emailMessage.payload
            );


          console.log(
            "Subject:",
            subject
          );


          console.log(
            "Sender:",
            sender
          );


          // ================================
          // AI ANALYSIS
          // ================================

          const prompt = `
You are an intelligent Gmail email classifier.

Analyze the following email and classify it into ONE short label.

You may use an existing common category if appropriate:

Work
Academics
Career
Finance
Shopping
Travel
Social
Promotions
Important
Personal
Updates

If none fit well, create a short meaningful label of 1-3 words.

Also extract the 3 to 8 most important keywords or short phrases
that would help someone understand the email quickly.

Return ONLY valid JSON in exactly this format:

{
  "label": "string",
  "confidence": 0.0,
  "keywords": [
    "keyword1",
    "keyword2"
  ]
}

Email details:

Subject: ${subject}

Sender: ${sender}

Body:
${body.substring(0, 6000)}
`;


          const completion =
            await groq.chat.completions.create({

              model:
                "openai/gpt-oss-20b",

              messages: [

                {
                  role: "system",

                  content:
                    "You are a precise email classification assistant. Always return valid JSON only."
                },

                {
                  role: "user",

                  content: prompt
                }

              ],

              temperature: 0.2,

              response_format: {
                type: "json_object"
              }

            });


          const aiResponse =
            completion
              .choices[0]
              .message
              .content;


          console.log(
            "AI Response:",
            aiResponse
          );


          const analysis =
            JSON.parse(
              aiResponse
            );


          const confidencePercent =
            Number(
              analysis.confidence
            ) * 100;


          // ================================
          // CHECK CONFIDENCE
          // ================================

          if (
            confidencePercent <
            Number(minConfidence)
          ) {

            console.log(
              `Skipping "${subject}" due to low confidence.`
            );


            results.push({

              success: false,

              skipped: true,

              subject,

              sender,

              label:
                analysis.label,

              confidence:
                analysis.confidence,

              keywords:
                analysis.keywords || [],

              error:
                `Low confidence (${confidencePercent.toFixed(0)}%)`

            });


            continue;

          }


          // ================================
          // FIND EXISTING LABEL
          // ================================

          let existingLabel =
            gmailLabels.find(

              (item) =>

                item.name.toLowerCase() ===

                analysis.label
                  .toLowerCase()

            );


          let labelId;


          // ================================
          // CREATE LABEL IF NEEDED
          // ================================

          if (!existingLabel) {

            if (!autoCreate) {

              console.log(
                `Skipping because label "${analysis.label}" does not exist.`
              );


              results.push({

                success: false,

                skipped: true,

                subject,

                sender,

                label:
                  analysis.label,

                confidence:
                  analysis.confidence,

                keywords:
                  analysis.keywords || [],

                error:
                  "Label does not exist and automatic label creation is disabled."

              });


              continue;

            }


            console.log(
              `Creating label: ${analysis.label}`
            );


            const createResponse =
              await gmail.users.labels.create({

                userId: "me",

                requestBody: {

                  name:
                    analysis.label,

                  labelListVisibility:
                    "labelShow",

                  messageListVisibility:
                    "show"

                }

              });


            existingLabel =
              createResponse.data;


            // Add newly created label
            // to our local label list

            gmailLabels.push(
              existingLabel
            );


            labelId =
              existingLabel.id;

          } else {

            labelId =
              existingLabel.id;

          }


          // ================================
          // APPLY LABEL
          // ================================

          await gmail.users.messages.modify({

            userId: "me",

            id: message.id,

            requestBody: {

              addLabelIds: [
                labelId
              ]

            }

          });


          console.log(
            `Applied "${analysis.label}" to "${subject}"`
          );


          // ================================
          // SAVE RESULT
          // ================================

          results.push({

            success: true,

            subject,

            sender,

            label:
              analysis.label,

            confidence:
              analysis.confidence,

            keywords:
              analysis.keywords || []

          });


          // ================================
          // UPDATE SUMMARY
          // ================================

          if (
            summary[
              analysis.label
            ]
          ) {

            summary[
              analysis.label
            ]++;

          } else {

            summary[
              analysis.label
            ] = 1;

          }


        } catch (emailError) {

          console.error(
            "Error processing email:",
            emailError
          );


          results.push({

            success: false,

            subject:
              "Unknown email",

            error:
              emailError.message

          });

        }

      }


      console.log(
        "\n===== INBOX ANALYSIS COMPLETE ====="
      );


      console.log(
        "Summary:",
        summary
      );


      // ====================================
      // RETURN RESULTS
      // ====================================

      res.json({

        success: true,

        total:
          messages.length,

        analyzed:
          results.filter(
            item =>
              item.success
          ).length,

        results,

        summary

      });


    } catch (error) {

      console.error(
        "Inbox analysis error:",
        error
      );


      res.status(500).json({

        success: false,

        error:
          "Failed to analyze inbox."

      });

    }

  }
);


// ==========================================
// START SERVER
// ==========================================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `Smart Labeler backend running on http://localhost:${PORT}`
  );

});