/**
 * Import a single World Anvil article
 * @param {string} articleId            The World Anvil article ID to import
 * @param {JournalEntry|null} entry     An existing Journal Entry to sync
 * @return {Promise<JournalEntry>}
 */
export async function importArticle(articleId, {entry = null, renderSheet = false} = {}) {
  const anvil = game.modules.get("world-anvil").anvil;
  const article = await anvil.getArticle(articleId);
  const categoryId = article.category ? article.category.id : "0";
  const folder = game.folders.find(f => f.getFlag("world-anvil", "categoryId") === categoryId);
  const content = await _getArticleContent(article);

  // Update an existing Journal Entry
  if ( entry ) {
    await entry.update({
      name: article.title,
      content: content.html,
      img: content.img
    });
    ui.notifications.info(`Refreshed World Anvil article ${article.title}`);
    return entry;
  }

  // Create a new Journal Entry
  entry = await JournalEntry.create({
    name: article.title,
    content: content.html,
    img: content.img,
    folder: folder ? folder.id : null,
    "flags.world-anvil.articleId": article.id
  }, {renderSheet});
  ui.notifications.info(`Imported World Anvil article ${article.title}`);
  return entry;
}


/* -------------------------------------------- */


/**
 * Transform a World Anvil article HTML into a Journal Entry content and featured image.
 * @param {object} article
 * @return {{img: string, html: string}}
 * @private
 */
async function _getArticleContent(article) {
  let body = "";
  let aside = "";
  let sidePanel = {
    top: "",
    main: "",
    bottom: ""
  }

  /**
   * Need 3 sections.
   * Main Article Content
   * Main Article Sections
   * Sidebar information (side-top, side, site-bottom)
   */
  // Article sections
  if ( article.sections ) {
    for (let [id, section] of Object.entries(article.sections)) {
      let title = section.title || id.titleCase();
      switch (title.toLowerCase()) {
        case 'sidepanelcontent':
          sidePanel.main += `<div class="sidebar-content">${section.content_parsed}</div><hr/>`;
          break;
        case 'sidebarcontentbottom':
          sidePanel.bottom += `<div class="sidebar-bottom">${section.content_parsed}</div><hr/>`;
          break;
        case 'sidebarcontenttop':
          sidePanel.top += `<div class="sidebar-top">${section.content_parsed}</div><hr/>`;
          break;
        default:
          body += `<h2>${title}</h2>\n<p>${section.content_parsed}</p><hr/>`;
      }
    }
  }

  // Article relations
  if ( article.relations ) {
    for (let [id, section] of Object.entries(article.relations)) {
      const title = section.title || id.titleCase();
      const items = section.items instanceof Array ? section.items : [section.items];  // Items can be one or many
      const relations = items.filter(i => i.type !== 'customarticletemplate' && i.type !== 'image')
          .map(i => `< span data-article-id="${i.id}" data-template="${i.type}">${i.title} </span>`);

      if ( relations.length > 0 ) {
        aside += `<dt>${title}:</dt><dd>${relations.join(", ")}</dd>`;
      }
    }
  }

  // Combine content sections
  let content = `<h1>${article.title}</h1>\n`;
  content += `<p><a href="${article.url}" title="${article.title} ${game.i18n.localize("WA.OnWA")}" target="_blank">${article.url}</a></p>\n<div class="article-container page"><div class="article-content">${article.content_parsed}`;
  if ( body ) content += `${body}</div><hr/>`;
  else content += "</div><hr/>";
  if ( sidePanel.top || sidePanel.main || sidePanel.bottom ) {
    content += `<div class="panel panel-default">`
    if ( sidePanel.top ) content += sidePanel.top;
    if ( sidePanel.main ) content += sidePanel.main;
    if ( sidePanel.bottom ) content += sidePanel.bottom;
    content += "</div>";
  }
  if ( aside ) content += `<aside><dl>${aside}</dl></aside>`;
  content += "</div>";

  // Disable image source attributes so that they do not begin loading immediately
  content = content.replace(/src=/g, "data-src=");

  const div = document.createElement("div");
  const style = await _processCSS();
  div.innerHTML = content;

  // Paragraph Breaks
  const t = document.createTextNode("%p%");
  div.querySelectorAll("span.line-spacer").forEach(s => s.parentElement.replaceChild(t.cloneNode(), s));

  // Portrait Image as Featured or Cover image if no Portrait
  let image = null;
  if ( article.portrait ) {
    image = article.portrait.url.replace("http://", "https://");
  } else if ( article.cover ) {
    image = article.cover.url.replace("http://", "https://");
  }

  // Image from body
  div.querySelectorAll("img").forEach(i => {
    let img = new Image();
    img.src = `https://worldanvil.com${i.dataset.src}`;
    delete i.dataset.src;
    img.alt = i.alt;
    img.title = i.title;
    i.parentElement.replaceChild(img, i);
    image = image || img.src;
  });

  // World Anvil Content Links
  div.querySelectorAll('span[data-article-id]').forEach(el => {
    el.classList.add("entity-link", "wa-link");
  });
  div.querySelectorAll('a[data-article-id]').forEach(el => {
    el.classList.add("entity-link", "wa-link");
    const span = document.createElement("span");
    span.classList = el.classList;
    Object.entries(el.dataset).forEach(e => span.dataset[e[0]] = e[1]);
    span.textContent = el.textContent;
    el.replaceWith(span);
  });

  // Regex formatting
  let html = style + div.innerHTML;
  html = html.replace(/%p%/g, "</p>\n<p>");

  // Return content and image
  return {
    html: html,
    img: image
  }
}

/**
 * Import a single World Anvil article
 * @param {string} articleId            The World Anvil article ID to import
 * @param {JournalEntry|null} entry     An existing Journal Entry to sync
 * @return {Promise<JournalEntry>}
 */
async function _processCSS() {

  let css = game.modules.get("world-anvil").anvil.display_css;

  // Replace user-css and user-css-extended with world-anvil
  //   - Removes stand alone class
  css = css.replace(/\.user-css\S*,/g, "");
  //   - Replaces stacked classes
  css = css.replace( /\.user-css\S*[\n\s*]\.user-css\S*/g, ".word-anvil");
  //   - Replaces user-css and user-css-extended with world-anvil
  css = css.replace(/\.user-css\S*/g, ".world-anvil");
  let file = new File([css], "test.css");
  const fd = new FormData();
  fd.set("source", "data");
  fd.set("target", "modules/world-anvil/assets");
  fd.set("upload", file);
  fetch('/upload', {method: "POST", body: fd}).then(r => {
    console.log("AFTER FETCH");
    console.log(r);
  })

  return `<link href="/modules/world-anvil/assets/test.css" rel="stylesheet">`;
}