import type { Metadata,Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'여행안심 | 나의 안전 연락망',description:'여행 일정, 안전 확인과 가족·친구 비상연락망',appleWebApp:{capable:true,title:'여행안심',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#1b6558'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
