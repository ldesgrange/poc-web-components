import { library } from '@fortawesome/fontawesome-svg-core'
import { faCog, faSquareCheck, faSquareXmark, faPenToSquare, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import cssContent from './theme.css?raw'

// Add fontawesome icons used in the application.
library.add([
  faCog,
  faSquareCheck,
  faSquareXmark,
  faPenToSquare,
  faTrashCan,
])

export const theme = new CSSStyleSheet()
theme.replaceSync(cssContent)
