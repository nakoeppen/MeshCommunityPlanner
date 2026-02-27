Name:           mesh-community-planner
Version:        1.2.0
Release:        1%{?dist}
Summary:        Desktop web application for planning LoRa mesh network deployments
License:        CC-BY-NC-SA-4.0
URL:            https://github.com/PapaSierra555/MeshCommunityPlanner
Source0:        %{name}-%{version}.tar.gz

%description
Mesh Community Planner helps users plan LoRa mesh network deployments
with terrain-aware RF propagation modeling, bill-of-materials generation,
and regulatory compliance checking. Runs as a local web application
that opens in your default browser.

%prep
# No source archive prep needed — we bundle from PyInstaller output

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/%{name}
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/share/icons/hicolor/256x256/apps

# Copy PyInstaller output
cp -R %{_sourcedir}/MeshCommunityPlanner/* %{buildroot}/opt/%{name}/

# Create launcher script
cat > %{buildroot}/usr/bin/%{name} << 'EOF'
#!/bin/bash
exec /opt/mesh-community-planner/MeshCommunityPlanner "$@"
EOF
chmod +x %{buildroot}/usr/bin/%{name}

# Copy desktop file
cp %{_sourcedir}/mesh-community-planner.desktop %{buildroot}/usr/share/applications/

%files
%defattr(-,root,root,-)
/opt/%{name}
/usr/bin/%{name}
/usr/share/applications/%{name}.desktop

%changelog
* Thu Jan 01 2026 Mesh Community Planner Project <noreply@meshcommunityplanner.org> - 1.2.0-1
- Initial release
