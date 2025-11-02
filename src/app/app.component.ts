import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
//import { AdminModule } from './admin/admin.module';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Sotech-Inmo';
}
