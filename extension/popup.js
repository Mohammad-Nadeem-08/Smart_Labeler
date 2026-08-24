// ==========================================
// ELEMENTS
// ==========================================

const analyzeBtn = document.getElementById("analyzeBtn");
const inboxBtn = document.getElementById("inboxBtn");
const status = document.getElementById("status");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");

const emailLimit = document.getElementById("emailLimit");

const confidence = document.getElementById("confidence");
const confidenceValue = document.getElementById("confidenceValue");

const autoCreate = document.getElementById("autoCreate");

const highlightEnabled =
  document.getElementById("highlightEnabled");

const customKeywords =
  document.getElementById("customKeywords");

const themeSelect =
  document.getElementById("themeSelect");

const saveSettingsBtn =
  document.getElementById("saveSettingsBtn");


// ==========================================
// DEFAULT SETTINGS
// ==========================================

const defaultSettings = {
  emailLimit: 5,
  minConfidence: 50,
  autoCreateLabels: true,
  highlightKeywords: true,
  customKeywords: "",
  theme: "system"
};


// ==========================================
// THEME
// ==========================================

function applyTheme(theme) {

  document.documentElement.removeAttribute("data-theme");

  if (theme === "dark") {

    document.documentElement.setAttribute(
      "data-theme",
      "dark"
    );

  } else if (theme === "light") {

    document.documentElement.setAttribute(
      "data-theme",
      "light"
    );

  } else {

    const prefersDark =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light"
    );

  }

}


// ==========================================
// LOAD SETTINGS
// ==========================================

async function loadSettings() {

  try {

    const settings =
      await chrome.storage.sync.get(
        defaultSettings
      );


    emailLimit.value =
      settings.emailLimit;

    confidence.value =
      settings.minConfidence;

    confidenceValue.textContent =
      `${settings.minConfidence}%`;

    autoCreate.checked =
      settings.autoCreateLabels;

    highlightEnabled.checked =
      settings.highlightKeywords;

    customKeywords.value =
      settings.customKeywords;

    themeSelect.value =
      settings.theme;


    applyTheme(
      settings.theme
    );

  } catch (error) {

    console.error(
      "Failed to load settings:",
      error
    );

  }

}


// ==========================================
// SETTINGS PANEL
// ==========================================

settingsBtn.addEventListener(
  "click",
  () => {

    settingsPanel.classList.toggle(
      "hidden"
    );

  }
);


// ==========================================
// CONFIDENCE SLIDER
// ==========================================

confidence.addEventListener(
  "input",
  () => {

    confidenceValue.textContent =
      `${confidence.value}%`;

  }
);


// ==========================================
// THEME PREVIEW
// ==========================================

themeSelect.addEventListener(
  "change",
  () => {

    applyTheme(
      themeSelect.value
    );

  }
);


// ==========================================
// SAVE SETTINGS
// ==========================================

saveSettingsBtn.addEventListener(
  "click",
  async () => {

    try {

      await chrome.storage.sync.set({

        emailLimit:
          Number(emailLimit.value),

        minConfidence:
          Number(confidence.value),

        autoCreateLabels:
          autoCreate.checked,

        highlightKeywords:
          highlightEnabled.checked,

        customKeywords:
          customKeywords.value.trim(),

        theme:
          themeSelect.value

      });


      applyTheme(
        themeSelect.value
      );


      saveSettingsBtn.innerHTML =
        "✓ Settings Saved";

      setTimeout(() => {

        saveSettingsBtn.innerHTML =
          "💾 Save Settings";

      }, 1500);

    } catch (error) {

      console.error(
        "Failed to save settings:",
        error
      );

      saveSettingsBtn.innerHTML =
        "⚠️ Save Failed";

    }

  }
);


// ==========================================
// SYSTEM THEME LISTENER
// ==========================================

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener(
    "change",
    async () => {

      const settings =
        await chrome.storage.sync.get(
          defaultSettings
        );

      if (settings.theme === "system") {

        applyTheme("system");

      }

    }
  );


// ==========================================
// KEYWORD HELPERS
// ==========================================

function getCustomKeywords() {

  return customKeywords.value
    .split(",")
    .map(
      (keyword) =>
        keyword.trim()
    )
    .filter(
      (keyword) =>
        keyword.length > 0
    );

}


function mergeKeywords(
  aiKeywords = [],
  userKeywords = []
) {

  const keywordMap = new Map();


  [...aiKeywords, ...userKeywords]
    .forEach(
      (keyword) => {

        if (
          !keyword ||
          typeof keyword !== "string"
        ) {
          return;
        }


        const cleanKeyword =
          keyword.trim();

        if (!cleanKeyword) {
          return;
        }


        const normalized =
          cleanKeyword.toLowerCase();


        if (
          !keywordMap.has(
            normalized
          )
        ) {

          keywordMap.set(
            normalized,
            cleanKeyword
          );

        }

      }
    );


  return Array.from(
    keywordMap.values()
  );

}


// ==========================================
// BUTTON STATE MANAGEMENT
// ==========================================

function setButtonsLoading() {

  analyzeBtn.disabled = true;
  inboxBtn.disabled = true;
  settingsBtn.disabled = true;

}


function resetButtons() {

  analyzeBtn.disabled = false;
  inboxBtn.disabled = false;
  settingsBtn.disabled = false;

  analyzeBtn.innerHTML = `
    <span class="btn-icon">🔍</span>

    <span class="btn-content">
      <strong>Analyze Current Email</strong>
      <small>Classify and highlight instantly</small>
    </span>

    <span class="btn-arrow">→</span>
  `;


  inboxBtn.innerHTML = `
    <span class="btn-icon">📥</span>

    <span class="btn-content">
      <strong>Analyze Recent Emails</strong>
      <small>Organize multiple emails at once</small>
    </span>

    <span class="btn-arrow">→</span>
  `;

}


// ==========================================
// LOADING UI
// ==========================================

function showLoading(message) {

  status.innerHTML = `
    <div class="loading-status">

      <span class="loading-dot"></span>

      <span>${message}</span>

    </div>
  `;

}


// ==========================================
// ERROR UI
// ==========================================

function showError(message) {

  status.innerHTML = `
    <div class="error-message">

      <strong>
        ⚠️ Something went wrong
      </strong>

      <span>
        ${message}
      </span>

    </div>
  `;

  resetButtons();

}


// ==========================================
// GET SAVED SETTINGS
// ==========================================

async function getSettings() {

  return await chrome.storage.sync.get(
    defaultSettings
  );

}


// ==========================================
// APPLY KEYWORD HIGHLIGHTS
// ==========================================

function highlightKeywordsInTab(
  tabId,
  keywords
) {

  return new Promise(
    (resolve) => {

      chrome.tabs.sendMessage(

        tabId,

        {
          action:
            "HIGHLIGHT_KEYWORDS",

          keywords
        },

        (response) => {

          if (
            chrome.runtime.lastError
          ) {

            console.warn(
              "Highlight error:",
              chrome.runtime.lastError
            );

            resolve({
              success: false
            });

            return;
          }


          resolve(
            response || {
              success: true
            }
          );

        }

      );

    }
  );

}


// ==========================================
// SINGLE EMAIL ANALYSIS
// ==========================================

analyzeBtn.addEventListener(
  "click",
  async () => {

    setButtonsLoading();

    showLoading(
      "Extracting current email..."
    );


    try {

      const settings =
        await getSettings();


      const [tab] =
        await chrome.tabs.query({
          active: true,
          currentWindow: true
        });


      analyzeBtn.innerHTML =
        "⏳ Extracting...";


      chrome.tabs.sendMessage(

        tab.id,

        {
          action:
            "GET_CURRENT_EMAIL"
        },


        async (response) => {

          if (
            chrome.runtime.lastError
          ) {

            console.error(
              "Content script error:",
              chrome.runtime.lastError
            );

            showError(
              "Could not connect to Gmail. Refresh Gmail and try again."
            );

            return;

          }


          if (
            !response ||
            !response.success
          ) {

            showError(
              "Could not extract email. Make sure an email is open."
            );

            return;

          }


          const email =
            response.data;


          try {

            // ======================================
            // ANALYZE WITH AI
            // ======================================

            analyzeBtn.innerHTML =
              "🤖 Analyzing...";


            showLoading(
              "Analyzing email with AI..."
            );


            const backendResponse =
              await fetch(
                "http://localhost:3000/analyze",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json"
                  },

                  body:
                    JSON.stringify(email)
                }
              );


            if (
              !backendResponse.ok
            ) {

              throw new Error(
                `AI analysis failed (${backendResponse.status})`
              );

            }


            const result =
              await backendResponse.json();


            if (
              !result.success
            ) {

              throw new Error(
                result.error ||
                "AI analysis failed."
              );

            }


            // ======================================
            // CONFIDENCE CHECK
            // ======================================

            const confidencePercent =
              result.confidence * 100;


            if (
              confidencePercent <
              settings.minConfidence
            ) {

              status.innerHTML = `
                <div class="result">

                  <div class="error-message">

                    <strong>
                      ⚠️ Confidence Too Low
                    </strong>

                    <span>
                      AI confidence was
                      ${confidencePercent.toFixed(0)}%,
                      which is below your minimum setting of
                      ${settings.minConfidence}%.
                    </span>

                  </div>

                </div>
              `;

              resetButtons();

              return;

            }


            // ======================================
            // MERGE KEYWORDS
            // ======================================

            const userKeywords =
              settings.customKeywords
                .split(",")
                .map(
                  keyword =>
                    keyword.trim()
                )
                .filter(
                  keyword =>
                    keyword.length > 0
                );


            const finalKeywords =
              mergeKeywords(
                result.keywords || [],
                userKeywords
              );


            // ======================================
            // APPLY LABEL
            // ======================================

            if (
              settings.autoCreateLabels
            ) {

              analyzeBtn.innerHTML =
                "🏷️ Applying Label...";


              showLoading(
                `Applying "${result.label}" label...`
              );


              const labelResponse =
                await fetch(
                  "http://localhost:3000/gmail/apply-label",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json"
                    },

                    body:
                      JSON.stringify({
                        subject:
                          email.subject,

                        sender:
                          email.sender,

                        label:
                          result.label
                      })
                  }
                );


              const labelResult =
                await labelResponse.json();


              if (
                !labelResponse.ok ||
                !labelResult.success
              ) {

                throw new Error(
                  labelResult.error ||
                  "Failed to apply Gmail label."
                );

              }

            }


            // ======================================
            // HIGHLIGHT KEYWORDS
            // ======================================

            let highlightSuccess = false;


            if (
              settings.highlightKeywords &&
              finalKeywords.length > 0
            ) {

              analyzeBtn.innerHTML =
                "✨ Highlighting...";


              showLoading(
                "Highlighting important keywords..."
              );


              const highlightResponse =
                await highlightKeywordsInTab(
                  tab.id,
                  finalKeywords
                );


              highlightSuccess =
                highlightResponse.success !== false;

            }


            // ======================================
            // SHOW SUCCESS RESULT
            // ======================================

            const footerMessages = [];


            if (
              settings.autoCreateLabels
            ) {

              footerMessages.push(
                "🏷️ Label applied"
              );

            }


            if (
              highlightSuccess
            ) {

              footerMessages.push(
                "✨ Keywords highlighted"
              );

            }


            status.innerHTML = `
              <div class="result">

                <div class="success-header">

                  <div class="success-icon">
                    ✓
                  </div>

                  <div>

                    <h3>
                      Analysis Complete!
                    </h3>

                    <p>
                      Email organized successfully.
                    </p>

                  </div>

                </div>


                <div class="result-section">

                  <span class="result-label">
                    SMART LABEL
                  </span>

                  <div class="label-badge">
                    🏷️ ${result.label}
                  </div>

                </div>


                <div class="confidence-section">

                  <div class="confidence-header">

                    <span>
                      Confidence
                    </span>

                    <strong>
                      ${confidencePercent.toFixed(0)}%
                    </strong>

                  </div>


                  <div class="confidence-bar">

                    <div
                      class="confidence-progress"
                      style="
                        width:
                        ${Math.min(
                          Math.max(
                            confidencePercent,
                            0
                          ),
                          100
                        )}%
                      "
                    ></div>

                  </div>

                </div>


                <div class="result-section">

                  <span class="result-label">
                    IMPORTANT KEYWORDS
                  </span>


                  <div class="keywords">

                    ${
                      finalKeywords
                        .map(
                          keyword =>
                            `<span>${keyword}</span>`
                        )
                        .join("")
                    }

                  </div>

                </div>


                <div class="success-footer">

                  ${
                    footerMessages
                      .map(
                        message =>
                          `<span>${message}</span>`
                      )
                      .join("")
                  }

                </div>

              </div>
            `;


            resetButtons();


          } catch (error) {

            console.error(
              "Single email analysis error:",
              error
            );

            showError(
              error.message ||
              "Could not analyze email."
            );

          }

        }

      );


    } catch (error) {

      console.error(
        "Extension error:",
        error
      );

      showError(
        error.message ||
        "Something went wrong."
      );

    }

  }
);


// ==========================================
// ANALYZE RECENT INBOX
// ==========================================

inboxBtn.addEventListener(
  "click",
  async () => {

    setButtonsLoading();

    showLoading(
      "Fetching your recent Gmail emails..."
    );


    try {

      const settings =
        await getSettings();


      inboxBtn.innerHTML =
        "🤖 Analyzing Inbox...";


      const response =
        await fetch(
          "http://localhost:3000/gmail/analyze-inbox",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                limit:
                  settings.emailLimit
              })
          }
        );


      if (
        !response.ok
      ) {

        const errorData =
          await response.json();

        throw new Error(
          errorData.error ||
          "Failed to analyze inbox."
        );

      }


      const result =
        await response.json();


      if (
        !result.success
      ) {

        throw new Error(
          result.error ||
          "Inbox analysis failed."
        );

      }


      // ======================================
      // FILTER BY CONFIDENCE
      // ======================================

      const filteredResults =
        result.results.filter(
          email => {

            if (
              !email.success
            ) {
              return false;
            }


            return (
              email.confidence * 100 >=
              settings.minConfidence
            );

          }
        );


      // ======================================
      // BUILD SUMMARY
      // ======================================

      const summary = {};


      filteredResults.forEach(
        email => {

          summary[email.label] =
            (
              summary[email.label] || 0
            ) + 1;

        }
      );


      const summaryHtml =
        Object.entries(summary)
          .map(
            ([label, count]) => `
              <div class="summary-item">

                <span class="summary-label">
                  🏷️ ${label}
                </span>

                <span class="summary-count">
                  ${count}
                </span>

              </div>
            `
          )
          .join("");


      // ======================================
      // BUILD EMAIL RESULTS
      // ======================================

      const userKeywords =
        settings.customKeywords
          .split(",")
          .map(
            keyword =>
              keyword.trim()
          )
          .filter(
            keyword =>
              keyword.length > 0
          );


      const emailResultsHtml =
        filteredResults
          .map(
            email => {

              const combinedKeywords =
                mergeKeywords(
                  email.keywords || [],
                  userKeywords
                );


              return `
                <div class="email-result">

                  <div class="email-result-header">

                    <span class="email-subject">
                      ${email.subject}
                    </span>

                    <span class="email-label">
                      ${email.label}
                    </span>

                  </div>


                  <div class="email-sender">
                    ${email.sender}
                  </div>


                  <div class="email-keywords">

                    ${
                      combinedKeywords
                        .map(
                          keyword =>
                            `<span>${keyword}</span>`
                        )
                        .join("")
                    }

                  </div>

                </div>
              `;

            }
          )
          .join("");


      // ======================================
      // SHOW RESULTS
      // ======================================

      status.innerHTML = `

        <div class="inbox-result">

          <div class="success-header">

            <div class="success-icon">
              ✓
            </div>

            <div>

              <h3>
                Inbox Organized!
              </h3>

              <p>
                ${filteredResults.length}
                of
                ${result.total}
                emails met your confidence requirement.
              </p>

            </div>

          </div>


          <div class="inbox-summary">

            <span class="result-label">
              LABEL SUMMARY
            </span>

            <div class="summary-list">

              ${
                summaryHtml ||
                "<p>No emails met the confidence requirement.</p>"
              }

            </div>

          </div>


          <div class="inbox-emails">

            <span class="result-label">
              ANALYZED EMAILS
            </span>

            ${
              emailResultsHtml ||
              "<p>No matching emails found.</p>"
            }

          </div>

        </div>
      `;


      resetButtons();


    } catch (error) {

      console.error(
        "Inbox analysis error:",
        error
      );

      showError(
        error.message ||
        "Could not analyze your inbox."
      );

    }

  }
);


// ==========================================
// INITIALIZE
// ==========================================

loadSettings();