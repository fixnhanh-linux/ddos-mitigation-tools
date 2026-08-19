package PVE::CustomNetworkMetrics;

use strict;
use warnings;

# Hàm này sẽ được gọi từ PVE::Status::InfluxDB
sub get_metrics {

    my $result = {
        global => {},
        nics => {}
    };

    eval {
        # 1. Thu thập dữ liệu hệ thống (UDP/Corosync)
        my $udp_loss = `awk '/Udp:/ {print \$4}' /proc/net/snmp | tail -n 1`; chomp($udp_loss);
        my $udp_total = `awk '/Udp:/ {print \$2}' /proc/net/snmp | tail -n 1`; chomp($udp_total);
        my $corosync = `ss -una | grep -E '5404|5405' | wc -l`; chomp($corosync);

        $result->{global}->{udp_loss} = $udp_loss + 0;
        $result->{global}->{udp_total} = $udp_total + 0;
        $result->{global}->{corosync_conn} = $corosync + 0;

        # 2. Quét các card mạng (HW Drop và UP/DOWN)
        foreach my $iface (glob("/sys/class/net/*")) {
            $iface =~ s#.*/##;
            next if $iface eq 'lo';
            
            my $drop = `cat /sys/class/net/$iface/statistics/rx_dropped 2>/dev/null`; chomp($drop);
            if (defined($drop) && $drop =~ /^\d+$/) {
                $result->{nics}->{$iface}->{hardware_drop} = $drop + 0;
            }
            
            my $operstate = `cat /sys/class/net/$iface/operstate 2>/dev/null`; chomp($operstate);
            if (defined($operstate) && $operstate ne '') {
                $result->{nics}->{$iface}->{network_up} = ($operstate eq 'up' || $operstate eq 'unknown') ? 1 : 0;
            }
        }
    };
    if (my $err = $@) {
        warn "Loi khi thu thap advanced network metrics: $err\n";
    }

    return $result;
}

1;
