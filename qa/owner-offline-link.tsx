import React from 'react';
export default function OfflineLink({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>){return <a href={typeof href==='string'?href:'#'} {...props}>{children}</a>;}
