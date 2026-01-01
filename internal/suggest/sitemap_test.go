package suggest

import "testing"

func TestParseSitemapURLSet(t *testing.T) {
	data := []byte(`<urlset><url><loc>https://example.com/a</loc></url><url><loc> </loc></url></urlset>`)
	result, err := ParseSitemap(data)
	if err != nil {
		t.Fatalf("ParseSitemap: %v", err)
	}
	if len(result.URLs) != 1 || result.URLs[0] != "https://example.com/a" {
		t.Fatalf("unexpected urls: %#v", result.URLs)
	}
	if len(result.Sitemaps) != 0 {
		t.Fatalf("expected no sitemaps, got %#v", result.Sitemaps)
	}
}

func TestParseSitemapIndex(t *testing.T) {
	data := []byte(`<sitemapindex><sitemap><loc>https://example.com/sitemap.xml</loc></sitemap></sitemapindex>`)
	result, err := ParseSitemap(data)
	if err != nil {
		t.Fatalf("ParseSitemap: %v", err)
	}
	if len(result.Sitemaps) != 1 || result.Sitemaps[0] != "https://example.com/sitemap.xml" {
		t.Fatalf("unexpected sitemaps: %#v", result.Sitemaps)
	}
}

func TestParseSitemapInvalid(t *testing.T) {
	if _, err := ParseSitemap([]byte("<invalid")); err == nil {
		t.Fatalf("expected error for invalid XML")
	}
}
