/**
 * Word tables for encounter text. A template like "Young Master {surname} of
 * the {sect}" picks a random entry from the matching table.
 */
export const NAME_TABLES: Readonly<Record<string, readonly string[]>> = {
  surname: ['Wang', 'Zhao', 'Li', 'Chen', 'Xiao', 'Mu', 'Ye', 'Gu', 'Qin', 'Murong', 'Shangguan'],
  sect: [
    'Azure Cloud Sect',
    'Heavenly Sword Sect',
    'Blood Lotus Valley',
    'Nine Peaks Pavilion',
    'Frost Moon Palace',
    'Golden Crow Clan',
    'Myriad Poison Gate',
  ],
  relative: ['father', 'grandfather', 'uncle', 'master', 'great-great-grandmother'],
  elderTitle: ['Grand Elder', 'Sect Master', 'Patriarch', 'Hall Master', 'Supreme Elder'],
  beast: [
    'three-eyed ape',
    'thunder hawk',
    'jade-scaled python',
    'flame lion',
    'nine-tailed fox',
    'iron-backed tortoise',
  ],
  place: [
    'Misty Peak',
    'the Valley of Ten Thousand Graves',
    'Cloud-Piercing Cliff',
    'the Withered Forest',
    'Dragon Bone Ridge',
  ],
};
