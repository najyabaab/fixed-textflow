/// <reference types="vite/client" />

declare namespace chrome {
    namespace runtime {
        enum ContextType {
            TAB = 'TAB',
            POPUP = 'POPUP',
            BACKGROUND = 'BACKGROUND',
            OFFSCREEN_DOCUMENT = 'OFFSCREEN_DOCUMENT',
            SIDE_PANEL = 'SIDE_PANEL',
        }

        function getContexts(filter: { contextTypes: ContextType[] }): Promise<Array<{ contextType: ContextType }>>;
    }

    namespace offscreen {
        enum Reason {
            CLIPBOARD = 'CLIPBOARD',
            DOM_SCRAPING = 'DOM_SCRAPING',
            AUDIO_PLAYBACK = 'AUDIO_PLAYBACK',
        }

        function createDocument(params: {
            url: string;
            reasons: Reason[];
            justification: string;
        }): Promise<void>;

        function closeDocument(): Promise<void>;
    }
}
