<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const props = defineProps<{ content: string }>();

const renderedHtml = computed(() => marked.parse(props.content) as string);
</script>

<template>
  <div class="markdown-body" v-html="renderedHtml" />
</template>

<style scoped>
.markdown-body :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.markdown-body :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-body :deep(h3) {
  font-size: 1.125rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.markdown-body :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.7;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin-bottom: 0.75rem;
  padding-left: 1.5rem;
}
.markdown-body :deep(ul) {
  list-style-type: disc;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
}
.markdown-body :deep(li) {
  margin-bottom: 0.25rem;
}
.markdown-body :deep(a) {
  color: #0D47A1;
  text-decoration: underline;
}
.markdown-body :deep(a:hover) {
  color: #1565C0;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid #0D47A1;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #555;
  font-style: italic;
}
.markdown-body :deep(code) {
  background-color: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}
.markdown-body :deep(pre) {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}
.markdown-body :deep(pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 1rem 0;
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.5rem 0;
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background-color: #f9fafb;
  font-weight: 600;
}
</style>
