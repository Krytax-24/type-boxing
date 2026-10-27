/**
 * Race passages. Everyone in a race types the same passage, so every line here is original text written for
 * CounterType (no quotes copied from books, songs or other typing sites). Clean text like Arm Wrestling: lower case
 * letters and single spaces only, no punctuation, so the race is about typing words, not hunting for symbols.
 * Lengths: short about 120 characters, medium about 250, long about 450. Add new lines freely (tests/race-sim.js
 * checks the style and the lengths).
 */
CounterType.define("race-passages", [], () => {
  "use strict";

  const PASSAGES = {
    short: [
      "the night shift at the arcade begins when the last bus leaves and the cabinets hum like a choir that never learned the words",
      "a good racer does not look at the finish line she looks at the next word then the next one until there are no words left",
      "rain on the window sounds like typing from far away as if the whole city were writing a letter it would never send",
      "he kept a list of every road he had driven at night and the list was longer than any road he had ever driven by day",
      "the kettle clicked off the cat stretched and somewhere down the hall a printer started warming up for nobody at all",
      "speed is only a promise until the hands keep it breathe out find the rhythm and let the letters fall where they belong",
      "she painted the old bike blue tuned the engine by ear and rode it to the coast before the paint was even fully dry",
      "every keyboard has one key that is worn smooth mine is the space bar because i never stop moving on to the next idea",
    ],
    medium: [
      "the track was built on the roof of an old parking garage and on clear nights you could see the whole city from the third turn drivers said the view made them slower but nobody ever proved it the fastest lap belongs to a delivery rider who never once looked up",
      "my grandfather fixed radios in a shop the size of a closet he worked with the door open so people could hear the music come back to life when he retired the street felt quieter for a year and then somebody opened a coffee stand in the same small space",
      "there is a moment in every long race when your hands stop asking for permission the words arrive the fingers answer and the noise in your head goes quiet you cannot force that moment but you can practice until it finds you more often than not",
      "the lighthouse keeper kept a logbook with three columns the weather the ships and one thing that made her laugh most days the third column was the longest when the light was finally automated she took the logbook home and read it every winter",
      "our team built a robot that could sort socks by color and it failed in front of the judges because the lights in the hall were orange we lost the prize but won the crowd and the next year every single team brought their own lamp just in case",
      "if you want to get faster slow down first type the hard words carefully until your fingers remember the shape of them speed is what accuracy looks like after a few hundred repetitions and it lasts a lot longer than speed that skips the practice",
      "the night market opens at nine and closes when the last cook runs out of rice you can follow the smoke from street to street and every stall has a story about the first person who ever sold food in that exact spot usually a story about a brave aunt",
      "two old friends met on the same bench every sunday to argue about chess neither of them ever won an argument but they both got better at the game years later their grandchildren still meet on that bench and they still argue about the very same opening",
    ],
    long: [
      "the engine was older than the driver and both of them knew it every morning she listened to it cough twice before it caught then patted the dashboard like a horse that had agreed to one more day of work the race was a hundred laps of a small dusty oval behind the feed store and the prize was a trophy made from a spark plug welded to a brass doorknob she did not care about the trophy she cared about the twenty seconds after the flag dropped when every car was still in the pack and anything at all could happen",
      "learning to type well is a lot like learning to walk in a new city at first you stare at every street sign and take the long way around because it feels safe then one day you notice you have walked home without thinking about the turns at all the map moved from the paper into your feet keyboards work the same way the letters move from your eyes into your hands and once they live there you can look at the road ahead instead of the ground under you which is where the real race is",
      "the repair shop at the end of the pier fixed anything with a motor from boat engines to blenders and the owner charged by the story rather than by the hour tell him how the machine broke and he would set a price a good story got you a discount a boring one cost a little extra because he said boring machines were harder to fix nobody ever argued partly because the prices were fair and partly because the stories people told in that shop were the best entertainment on the whole coast",
      "at the top of the hill there is a road that drops away so steeply that cyclists tell each other about it in whispers you cannot see the bottom from the top only the sky and a guardrail that bends to the left riders gather there at sunrise not to race but to look and most of them turn around and ride back down the gentle side the few who take the steep road come back with the same quiet smile and when you ask them what it was like they only tell you to go and find out",
      "every arcade has a ghost score at the top of the board a set of initials nobody has beaten in years ours was three letters that spelled nothing in particular and the legend changed every time someone told it some said it belonged to a mechanic who fixed the cabinets after closing others swore it was a girl who only ever played one game and then moved to another country the truth which the owner finally admitted was that he set the score himself on the day the machine arrived just to give everyone something to chase",
      "the orchestra tuned for nearly ten minutes because the hall was cold and the strings kept drifting in the front row a little boy timed them with his new watch and announced the result to his mother in a whisper loud enough for the cellos to hear when the conductor finally raised his hands the whole room went still and the first note landed so softly that the boy forgot his watch completely afterward he said the best part was the waiting because it made the music feel like something they had all earned together",
    ],
  };

  return PASSAGES;
});
