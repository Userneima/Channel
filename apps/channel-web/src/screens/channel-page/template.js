export const channelPageTemplate = () => `
    <div class="channel-app">
        <aside class="channel-app__sidebar" data-screen-slot="sidebar-nav"></aside>
        <main class="channel-app__main">
            <div class="channel-app__content channel-page" data-screen-root>
                <div class="channel-page__scroll">
                    <div class="channel-page__top-region">
                        <div class="channel-page__top-inner">
                            <section data-screen-slot="channel-hero"></section>
                        </div>
                    </div>
                    <div class="channel-page__layout">
                        <div class="channel-page__main">
                            <section class="channel-page__composer" data-screen-slot="composer-panel"></section>
                            <section class="channel-page__tabs" data-screen-slot="board-tabs"></section>
                            <section class="channel-page__feed" data-screen-slot="feed-list"></section>
                        </div>
                        <aside class="channel-page__aside">
                            <section class="channel-page__join" data-screen-slot="join-request-panel"></section>
                            <section class="channel-page__review" data-screen-slot="membership-review-panel"></section>
                            <section class="channel-page__intelligence" data-screen-slot="channel-intelligence"></section>
                        </aside>
                    </div>
                </div>
            </div>
        </main>
        <div data-screen-slot="comment-drawer"></div>
        <div data-screen-slot="image-lightbox"></div>
        <div data-screen-slot="notification-center"></div>
        <div data-screen-slot="member-list-dialog"></div>
        <div data-screen-slot="channel-menu-dialog"></div>
        <div data-screen-slot="channel-settings-dialog"></div>
        <div data-screen-slot="channel-intelligence-dialog"></div>
        <div data-screen-slot="identity-dialog"></div>
        <div data-screen-slot="auth-gate"></div>
        <div data-screen-slot="search-dialog"></div>
        <div data-screen-slot="registered-users-dialog"></div>
        <div data-screen-slot="system-feedback"></div>
    </div>
`;
