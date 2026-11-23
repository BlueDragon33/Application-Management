export type Role="owner"|"reviewer"|"publisher"|"viewer";
export type PromptInput={appId:string;appName:string;role:Role;activeView:string;connectionState:"online"|"warning";observation:string;workTitle:string;sourceNote:string;extraRequirements:string};
export declare const PILOT_APPS:ReadonlyArray<string>;
export declare function hasSecret(value:unknown):boolean;
export declare function validatePrompt(input:PromptInput):string;
export declare function promptKey(input:PromptInput):string;
export declare function composePrompt(input:PromptInput):string;
