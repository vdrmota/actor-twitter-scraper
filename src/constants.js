/* eslint-disable max-classes-per-file */
const LABELS = {
    HANDLE: 'HANDLE',
    SEARCH: 'SEARCH',
    EVENTS: 'EVENTS',
};

const SEARCH_MODE = {
    TOP: 'top',
    LATEST: 'latest',
    PEOPLE: 'people',
    PHOTO: 'photo',
    VIDEO: 'video',
};

const TWEET_MODE = {
    OWN: 'own',
    REPLIES: 'replies',
};

const USER_OMIT_FIELDS = [
    'entities',
    'profile_image_extensions_alt_text',
    'profile_image_extensions_media_availability',
    'profile_image_extensions_media_color',
    'profile_image_extensions',
    'profile_banner_extensions_alt_text',
    'profile_banner_extensions_media_availability',
    'profile_banner_extensions_media_color',
    'profile_banner_extensions',
    'profile_link_color',
    'has_extended_profile',
    'default_profile',
    'pinned_tweet_ids',
    'pinned_tweet_ids_str',
    'advertiser_account_service_levels',
    'profile_interstitial_type',
    'ext',
];

module.exports = {
    LABELS,
    USER_OMIT_FIELDS,
    SEARCH_MODE,
    TWEET_MODE,
};
