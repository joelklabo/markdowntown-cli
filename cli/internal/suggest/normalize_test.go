package suggest

import "testing"

func TestNormalizeMarkdownHeadings(t *testing.T) {
	input := "# Title\nIntro text\n## Sub\nSub text"
	doc, err := NormalizeDocument(input, "md")
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if len(doc.Sections) != 2 {
		t.Fatalf("expected 2 sections, got %d", len(doc.Sections))
	}
	if doc.Sections[0].ID != "title" {
		t.Fatalf("expected title id, got %s", doc.Sections[0].ID)
	}
	if doc.Sections[1].ID != "sub" {
		t.Fatalf("expected sub id, got %s", doc.Sections[1].ID)
	}
}

func TestNormalizeMarkdownIgnoresCodeBlockHeadings(t *testing.T) {
	input := "# Title\n```\n# Not Heading\n```\nBody"
	doc, err := NormalizeDocument(input, "markdown")
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if len(doc.Sections) != 1 {
		t.Fatalf("expected 1 section, got %d", len(doc.Sections))
	}
}

func TestNormalizeHTML(t *testing.T) {
	input := "<h1>Title</h1><p>Hello</p><h2>Sub</h2><p>World</p>"
	doc, err := NormalizeDocument(input, "html")
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if len(doc.Sections) != 2 {
		t.Fatalf("expected 2 sections, got %d", len(doc.Sections))
	}
	if doc.Sections[0].ID != "title" || doc.Sections[1].ID != "sub" {
		t.Fatalf("unexpected section ids: %v", []string{doc.Sections[0].ID, doc.Sections[1].ID})
	}
}

func TestNormalizeMalformedHTML(t *testing.T) {
	input := "<h1>Title<p>Missing close"
	doc, err := NormalizeDocument(input, "html")
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if len(doc.Sections) == 0 {
		t.Fatalf("expected sections for malformed html")
	}
}
