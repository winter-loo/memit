import { mount } from 'svelte';
import './app.css';
import Options from './Options.svelte';

const app = mount(Options, {
  target: document.getElementById('app')!,
});

export default app;
