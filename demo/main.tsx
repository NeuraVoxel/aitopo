import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { registerDemoVectorImages } from './lib/vector-images.ts'
import './styles.css'

registerDemoVectorImages()

const el = document.querySelector('#root')
if (el === null) throw new Error('missing #root')
createRoot(el).render(<App />)
