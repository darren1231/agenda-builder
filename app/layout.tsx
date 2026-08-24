import type { Metadata } from 'next';
import './globals.css';

export const metadata:Metadata={title:'SYTC Agenda Builder',description:'Upload the SYTC Excel workbook and generate a meeting agenda instantly.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-Hant"><body>{children}</body></html>}
