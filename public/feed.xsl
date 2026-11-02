<?xml version="1.0" encoding="UTF-8"?>
<!-- Shown in browsers when someone opens /feed.xml. Feed readers ignore this stylesheet and read the data. -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom" exclude-result-prefixes="atom">
  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat"/>

  <xsl:template match="/">
    <xsl:variable name="de" select="substring(/rss/channel/language, 1, 2) = 'de'"/>
    <html lang="{/rss/channel/language}">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> – RSS</title>
        <style>
          body { margin: 0; background: #f4efe6; color: #2a2521; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
          main { max-width: 760px; margin: 0 auto; padding: 32px 20px 56px; }
          h1 { font-size: 1.9rem; margin: 0 0 4px; }
          .lead { color: #5b5249; margin: 0 0 22px; }
          .box { background: #fffdf8; border: 1px solid #d8cdbb; border-left: 4px solid #c9372c; border-radius: 6px; padding: 16px 18px; margin-bottom: 28px; }
          .box p { margin: 0 0 10px; }
          .box p:last-child { margin-bottom: 0; }
          code { display: block; word-break: break-all; background: #efe8db; padding: 8px 10px; border-radius: 4px; font-size: 0.9rem; }
          h2 { font-size: 1.15rem; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #5b5249; }
          ul.items { list-style: none; margin: 0; padding: 0; }
          li.item { background: #fffdf8; border: 1px solid #d8cdbb; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; }
          li.item.daily { border-left: 4px solid #c9372c; }
          .date { font-size: 0.85rem; color: #7a6f63; margin-bottom: 4px; }
          .title { font-weight: 700; font-size: 1.05rem; }
          .title a { color: #2a2521; text-decoration: none; }
          .title a:hover { text-decoration: underline; }
          .desc { margin: 6px 0 0; color: #3d3630; }
          footer { margin-top: 32px; font-size: 0.9rem; color: #7a6f63; }
          footer a { color: #c9372c; }
        </style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lead"><xsl:value-of select="/rss/channel/description"/></p>

          <section class="box">
            <p>
              <xsl:choose>
                <xsl:when test="$de">Das ist ein RSS-Feed. Kopiere die Adresse unten in deinen Feed-Reader, dann bekommst du neue Fallakten und den Fall des Tages automatisch.</xsl:when>
                <xsl:otherwise>This is an RSS feed. Copy the address below into your feed reader to get new case files and the case of the day automatically.</xsl:otherwise>
              </xsl:choose>
            </p>
            <code><xsl:value-of select="/rss/channel/atom:link/@href"/></code>
          </section>

          <h2>
            <xsl:choose>
              <xsl:when test="$de">Neueste Fallakten</xsl:when>
              <xsl:otherwise>Latest case files</xsl:otherwise>
            </xsl:choose>
          </h2>

          <ul class="items">
            <xsl:for-each select="/rss/channel/item">
              <li>
                <xsl:attribute name="class">item<xsl:if test="starts-with(title, 'Case of the day') or starts-with(title, 'Fall des Tages')"> daily</xsl:if></xsl:attribute>
                <div class="date"><xsl:value-of select="pubDate"/></div>
                <div class="title"><a href="{link}"><xsl:value-of select="title"/></a></div>
                <p class="desc"><xsl:value-of select="description"/></p>
              </li>
            </xsl:for-each>
          </ul>

          <footer>
            <a href="{/rss/channel/link}">
              <xsl:choose>
                <xsl:when test="$de">Zur Webseite</xsl:when>
                <xsl:otherwise>Go to the website</xsl:otherwise>
              </xsl:choose>
            </a>
          </footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
