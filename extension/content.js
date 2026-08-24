console.log("Smart Labeler content script loaded");


// ==========================================
// GET CURRENT EMAIL
// ==========================================

function getCurrentEmail() {
  const subjectElement = document.querySelector("h2.hP");
  const senderElement = document.querySelector(".gD");

  // Get the last visible Gmail message body
  const bodyElements = [
    ...document.querySelectorAll(".a3s.aiL")
  ].filter((element) => {
    return element.offsetParent !== null;
  });

  const bodyElement =
    bodyElements[bodyElements.length - 1];

  return {
    subject: subjectElement
      ? subjectElement.innerText.trim()
      : "Subject not found",

    sender: senderElement
      ? senderElement.getAttribute("email") ||
        senderElement.innerText.trim()
      : "Sender not found",

    body: bodyElement
      ? bodyElement.innerText.trim()
      : "Email body not found"
  };
}


// ==========================================
// ESCAPE REGEX CHARACTERS
// ==========================================

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// ==========================================
// REMOVE OLD HIGHLIGHTS
// ==========================================

function removeOldHighlights() {
  const highlights = document.querySelectorAll(
    ".smart-labeler-highlight"
  );

  highlights.forEach((highlight) => {
    const textNode = document.createTextNode(
      highlight.textContent
    );

    highlight.replaceWith(textNode);
  });

  console.log(
    `Removed ${highlights.length} old highlights`
  );
}


// ==========================================
// HIGHLIGHT TEXT INSIDE ONE EMAIL BODY
// ==========================================

function highlightBody(bodyElement, regex) {
  let highlightedCount = 0;

  const walker = document.createTreeWalker(
    bodyElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // Ignore empty nodes
        if (!node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        // Ignore script and style elements
        const parent = node.parentElement;

        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (
          parent.tagName === "SCRIPT" ||
          parent.tagName === "STYLE"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Ignore existing Smart Labeler highlights
        if (
          parent.classList.contains(
            "smart-labeler-highlight"
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];

  let node;

  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  console.log(
    "Text nodes found:",
    textNodes.length
  );

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;

    regex.lastIndex = 0;

    if (!regex.test(text)) {
      return;
    }

    regex.lastIndex = 0;

    const fragment =
      document.createDocumentFragment();

    let lastIndex = 0;

    text.replace(
      regex,
      (match, _group, offset) => {
        // Add normal text before keyword
        if (offset > lastIndex) {
          fragment.appendChild(
            document.createTextNode(
              text.substring(
                lastIndex,
                offset
              )
            )
          );
        }

        // Create highlighted element
        const highlight =
          document.createElement("span");

        highlight.className =
          "smart-labeler-highlight";

        highlight.textContent = match;

        // Useful for debugging
        highlight.setAttribute(
          "data-smart-labeler",
          "true"
        );

        fragment.appendChild(highlight);

        lastIndex =
          offset + match.length;

        highlightedCount++;
      }
    );

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(
        document.createTextNode(
          text.substring(lastIndex)
        )
      );
    }

    textNode.parentNode.replaceChild(
      fragment,
      textNode
    );
  });

  return highlightedCount;
}


// ==========================================
// HIGHLIGHT KEYWORDS
// ==========================================

function highlightKeywords(keywords) {
  console.log(
    "===== KEYWORD HIGHLIGHTING STARTED ====="
  );

  console.log(
    "Received keywords:",
    keywords
  );

  // Remove old highlights first
  removeOldHighlights();

  if (
    !Array.isArray(keywords) ||
    keywords.length === 0
  ) {
    return {
      success: false,
      error: "No keywords received"
    };
  }

  // Clean keywords
  const validKeywords = keywords
    .filter(
      (keyword) =>
        typeof keyword === "string" &&
        keyword.trim().length > 0
    )
    .map((keyword) => keyword.trim())
    .sort(
      (a, b) =>
        b.length - a.length
    );

  console.log(
    "Valid keywords:",
    validKeywords
  );

  if (validKeywords.length === 0) {
    return {
      success: false,
      error: "No valid keywords found"
    };
  }

  // Create regex
  const regexPattern =
    validKeywords
      .map(escapeRegex)
      .join("|");

  const regex = new RegExp(
    `(${regexPattern})`,
    "gi"
  );

  console.log(
    "Regex:",
    regex
  );

  // Get ALL visible Gmail email bodies
  const bodyElements = [
    ...document.querySelectorAll(".a3s.aiL")
  ].filter((element) => {
    return element.offsetParent !== null;
  });

  console.log(
    "Visible Gmail bodies found:",
    bodyElements.length
  );

  if (bodyElements.length === 0) {
    return {
      success: false,
      error: "Could not find Gmail email body"
    };
  }

  let totalHighlighted = 0;

  // Highlight every visible email body
  bodyElements.forEach((bodyElement) => {
    const count =
      highlightBody(
        bodyElement,
        regex
      );

    totalHighlighted += count;
  });

  console.log(
    `===== HIGHLIGHT COMPLETE: ${totalHighlighted} matches =====`
  );

  return {
    success: true,
    highlightedCount: totalHighlighted
  };
}


// ==========================================
// MESSAGE LISTENER
// ==========================================

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    console.log(
      "Message received:",
      request
    );

    // -------------------------
    // PING
    // -------------------------

    if (request.action === "PING") {
      sendResponse({
        success: true,
        message:
          "Content script is connected!"
      });

      return;
    }


    // -------------------------
    // GET CURRENT EMAIL
    // -------------------------

    if (
      request.action ===
      "GET_CURRENT_EMAIL"
    ) {
      const emailData =
        getCurrentEmail();

      console.log(
        "Extracted email:",
        emailData
      );

      sendResponse({
        success: true,
        data: emailData
      });

      return;
    }


    // -------------------------
    // HIGHLIGHT KEYWORDS
    // -------------------------

    if (
      request.action ===
      "HIGHLIGHT_KEYWORDS"
    ) {
      const result =
        highlightKeywords(
          request.keywords || []
        );

      console.log(
        "Highlight result:",
        result
      );

      sendResponse(result);

      return;
    }
  }
);