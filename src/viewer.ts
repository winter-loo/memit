import { mount } from 'svelte';
import './app.css';
import Viewer from './Viewer.svelte';
import './content/modal'; // Enable modal in viewer

const app = mount(Viewer, {
  target: document.getElementById('app')!,
});

// Apply theme to body
chrome.storage.sync.get(['theme'], (result) => {
  const theme = result.theme ?? 'light';
  if (theme === 'light') {
    document.body.classList.add('memit-light');
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.theme) {
    if (changes.theme.newValue === 'light') {
      document.body.classList.add('memit-light');
    } else {
      document.body.classList.remove('memit-light');
    }
  }
});

export default app;