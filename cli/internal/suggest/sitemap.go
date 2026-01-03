package suggest

import (
	"encoding/xml"
	"strings"
)

// SitemapResult captures URLs or nested sitemaps.
type SitemapResult struct {
	URLs     []string
	Sitemaps []string
}

// ParseSitemap parses sitemap XML into URL or sitemap lists.
func ParseSitemap(data []byte) (SitemapResult, error) {
	var urlset struct {
		URLs []struct {
			Loc string `xml:"loc"`
		} `xml:"url"`
	}

	if err := xml.Unmarshal(data, &urlset); err == nil && len(urlset.URLs) > 0 {
		out := SitemapResult{}
		for _, entry := range urlset.URLs {
			loc := strings.TrimSpace(entry.Loc)
			if loc == "" {
				continue
			}
			out.URLs = append(out.URLs, loc)
		}
		return out, nil
	}

	var index struct {
		Sitemaps []struct {
			Loc string `xml:"loc"`
		} `xml:"sitemap"`
	}

	if err := xml.Unmarshal(data, &index); err != nil {
		return SitemapResult{}, err
	}

	out := SitemapResult{}
	for _, entry := range index.Sitemaps {
		loc := strings.TrimSpace(entry.Loc)
		if loc == "" {
			continue
		}
		out.Sitemaps = append(out.Sitemaps, loc)
	}
	return out, nil
}
