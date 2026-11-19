export const SPORTS_CONFIG = [
  {
    slug: "football",
    name: "Football",
    hasPositions: true,
    positions: [
      { value: "goalkeeper", label: "Goalkeeper" },
      { value: "defender", label: "Defender" },
      { value: "midfielder", label: "Midfielder" },
      { value: "forward", label: "Forward" },
      { value: "winger", label: "Winger" },
      { value: "not_sure", label: "Beginner / Not Sure Yet" }
    ]
  },
  {
    slug: "cricket",
    name: "Cricket",
    hasPositions: true,
    positions: [
      { value: "batsman", label: "Batsman" },
      { value: "all_rounder", label: "All-Rounder" },
      { value: "wicketkeeper", label: "Wicketkeeper" },
      { value: "fast_bowler", label: "Fast Bowler" },
      { value: "fast_medium_bowler", label: "Fast-Medium Bowler" },
      { value: "medium_pacer", label: "Medium Pacer" },
      { value: "leg_spinner", label: "Leg Spinner" },
      { value: "off_spinner", label: "Off Spinner" },
      { value: "left_arm_orthodox", label: "Left-Arm Orthodox Spinner" },
      { value: "left_arm_wrist_spin", label: "Left-Arm Wrist Spinner" },
      { value: "not_sure", label: "Beginner / Not Sure Yet" }
    ]
  },
  {
    slug: "pickleball",
    name: "Pickleball",
    hasPositions: false,
    positions: []
  },
  {
    slug: "badminton",
    name: "Badminton",
    hasPositions: false,
    positions: []
  },
  {
    slug: "lawn_tennis",
    name: "Lawn Tennis",
    hasPositions: false,
    positions: []
  },
  {
    slug: "table_tennis",
    name: "Table Tennis",
    hasPositions: false,
    positions: []
  },
  {
    slug: "swimming",
    name: "Swimming",
    hasPositions: false,
    positions: []
  },
  {
    slug: "basketball",
    name: "Basketball",
    hasPositions: true,
    positions: [
      { value: "point_guard", label: "Point Guard" },
      { value: "shooting_guard", label: "Shooting Guard" },
      { value: "small_forward", label: "Small Forward" },
      { value: "power_forward", label: "Power Forward" },
      { value: "center", label: "Center" },
      { value: "not_sure", label: "Beginner / Not Sure Yet" }
    ]
  },
  {
    slug: "chess",
    name: "Chess",
    hasPositions: false,
    positions: []
  }
];

export const EXPERIENCE_RATING = {
  MIN: 1,
  MAX: 10,
  DEFAULT: 1,
  CATEGORIES: {
    BEGINNER: { min: 1, max: 3, label: "Beginner" },
    INTERMEDIATE: { min: 4, max: 7, label: "Intermediate" },
    ADVANCED: { min: 8, max: 10, label: "Advanced" }
  },
  getCategory: (level) => {
    if (level >= 1 && level <= 3) return "Beginner";
    if (level >= 4 && level <= 7) return "Intermediate";
    if (level >= 8 && level <= 10) return "Advanced";
    return "Unknown";
  }
};
