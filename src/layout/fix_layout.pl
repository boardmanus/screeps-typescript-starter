#!/usr/bin/perl
foreach my $line (<STDIN>) {
    $line =~ s/x: ([0-9]+)/$x = ($1 - 26);"x: $x"/eg;
    $line =~ s/y: ([0-9]+)/$y = ($1 - 22);"y: $y"/eg;
    print $line;
}
