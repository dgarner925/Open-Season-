/**
 * Topographic contour lines, run very faint off the bottom-left corner.
 *
 * The one element of the Field Survey canvas (2026-11-07) that never reached
 * the app: the palette, fonts and hairline lists already matched, so the
 * texture was the only thing still living in the mock. Without it the page is
 * a flat sheet of near-black and every group has to earn its separation with
 * a box — which is how Home ended up as a stack of identical tiles.
 *
 * It is land, not ornament: concentric rings reading as a hillside, the same
 * figure the medallion plates are drawn against. It bleeds off two edges so
 * no ring ever closes — a closed ring reads as a sticker.
 *
 * Only the lower group is drawn. The canvas also had a set bleeding off the
 * top-right, but that corner belongs to the species watermark behind the
 * headline, and two faint textures in one corner read as a smudge.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

/** Opacity per ring, outermost faintest — the hillside recedes. */
const RINGS: { d: string; o: number }[] = [
  {
    d: 'M-9 849C-17 844 -23 837 -29 829C-34 822 -40 812 -40 804C-40 795 -35 785 -29 778C-24 770 -15 765 -7 760C1 755 11 749 20 748C30 748 43 750 51 755C59 760 66 770 70 778C74 786 76 796 76 804C76 813 73 822 68 830C64 838 57 845 49 850C41 855 29 861 20 861C10 861 -1 855 -9 849Z',
    o: 0.082,
  },
  {
    d: 'M-30 882C-44 875 -60 863 -68 850C-76 837 -77 819 -77 804C-76 788 -72 772 -64 759C-56 746 -43 732 -29 725C-15 718 4 717 21 716C37 716 56 718 71 724C85 731 102 744 109 757C116 771 113 789 112 804C110 820 108 834 101 848C95 862 87 882 73 890C59 898 37 896 19 895C2 894 -15 890 -30 882Z',
    o: 0.07,
  },
  {
    d: 'M-48 911C-67 900 -82 881 -93 864C-105 846 -117 824 -118 803C-120 782 -114 756 -102 738C-90 720 -67 709 -46 697C-26 685 -2 666 21 666C43 666 70 682 89 695C108 708 125 725 135 743C146 762 154 784 155 805C155 825 149 849 138 867C127 886 108 904 88 915C69 925 42 930 19 929C-3 928 -29 921 -48 911Z',
    o: 0.058,
  },
  {
    d: 'M-67 941C-92 925 -111 905 -128 882C-146 859 -170 830 -172 803C-174 776 -156 742 -138 719C-121 696 -94 675 -67 663C-41 650 -8 644 21 644C50 645 81 654 107 667C134 679 165 698 179 721C193 744 190 777 190 805C190 833 192 865 178 889C165 913 136 933 109 948C82 962 48 979 19 978C-10 977 -43 957 -67 941Z',
    o: 0.047,
  },
];

/**
 * Fills its parent. Sits behind everything and takes no touches, so it can be
 * dropped in or removed without any other change to the screen.
 */
export function Contours({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 390 900" preserveAspectRatio="xMinYMax slice">
        <G stroke="#E8E6E1" strokeWidth={1} fill="none">
          {RINGS.map((r) => (
            <Path key={r.d.slice(0, 16)} d={r.d} strokeOpacity={r.o} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
